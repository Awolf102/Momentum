import { describe, expect, it, vi } from 'vitest'
import {
  chatRoute,
  failsOver,
  isPrivateAddress,
  mayAnswer,
  migrateChat,
  parseChain,
  usageLabel,
  usageProviderOf,
  type ChatEntry,
} from './chain'
import { describeRoute, type EntryStatus } from './chainStatus'
import { createAiClient, type ChainTiming } from './client'
import { AiError, describeAiError } from './errors'
import { freeFallbacks, openRouterLimit } from './providers/openrouter'
import { createMockProvider, type MockProvider } from './providers/mock'
import { DEFAULT_AI_SETTINGS, type AiSettings } from './store'
import type { ChatEvent, ChatFeature, Connection } from './types'

const HOME = 'https://pc.tail1234.ts.net/v1'
const MAC = 'https://mac.tail1234.ts.net/v1'
const ROUTER = 'https://openrouter.ai/api/v1'

const home: ChatEntry = {
  id: 'home',
  provider: 'compatible',
  name: 'Home PC',
  baseUrl: HOME,
  model: 'qwen3.6:35b',
  fallback: false,
}
const mac: ChatEntry = {
  id: 'mac',
  provider: 'compatible',
  name: 'Mac',
  baseUrl: MAC,
  model: 'qwen3.5:4b',
  fallback: false,
}
const router: ChatEntry = {
  id: 'router',
  provider: 'compatible',
  name: 'OpenRouter',
  baseUrl: ROUTER,
  model: 'qwen/qwen3-8b:free',
  fallback: true,
}

/**
 * A client whose chat list is `chain`, each server answering from its own
 * mock. Waits are short and the clock is the test's.
 */
function setup({
  chain,
  providers,
  keys = {},
  timing = {},
  thinking = {},
}: {
  chain: ChatEntry[]
  providers: Record<string, MockProvider>
  keys?: Record<string, string>
  timing?: Partial<ChainTiming>
  thinking?: Partial<Record<ChatFeature, boolean>>
}) {
  const settings: AiSettings = {
    ...DEFAULT_AI_SETTINGS,
    chat: { chain },
    thinking: { ...DEFAULT_AI_SETTINGS.thinking, ...thinking },
  }
  let clock = 1_000_000
  const statuses: Record<string, EntryStatus[]> = {}
  const recordUsage = vi.fn()
  const sleep = vi.fn(async () => {})
  const createProvider = vi.fn(
    (connection: Connection) =>
      providers[connection.baseUrl ?? connection.provider],
  )
  const client = createAiClient({
    getSettings: () => settings,
    getKey: async (name) => keys[name],
    createProvider,
    recordUsage,
    retry: { sleep, random: () => 0.5 },
    onStatus: (id, status) => (statuses[id] ??= []).push(status),
    timing: {
      healthMs: 40,
      firstTokenMs: 40,
      firstTokenThinkingMs: 150,
      ...timing,
    },
    now: () => clock,
  })
  const last = (id: string) => statuses[id]?.at(-1)
  return {
    client,
    recordUsage,
    sleep,
    createProvider,
    statuses,
    last,
    advance: (ms: number) => (clock += ms),
  }
}

/** Reads a reply through: its text, events, and the error it ended with. */
async function read(stream: AsyncIterable<ChatEvent>) {
  const events: ChatEvent[] = []
  let text = ''
  let error: AiError | undefined
  try {
    for await (const event of stream) {
      events.push(event)
      if (event.type === 'text') text += event.text
    }
  } catch (caught) {
    error = caught as AiError
  }
  const sources = events.flatMap((event) =>
    event.type === 'source' ? [event.source] : [],
  )
  return { text, events, error, source: sources.at(-1), sources }
}

const ask = { messages: [{ role: 'user' as const, content: 'Hi' }] }
const offline = () => new AiError('network', 'Load failed')

describe('chat’s providers, in order', () => {
  it('answers from the first when it’s up, and says which one it was', async () => {
    const pc = createMockProvider({ replies: [{ chunks: ['From the PC'] }] })
    const laptop = createMockProvider()
    const { client, recordUsage, last } = setup({
      chain: [home, mac],
      providers: { [HOME]: pc, [MAC]: laptop },
    })
    const reply = await read(client.chat(ask))
    expect(reply.text).toBe('From the PC')
    expect(reply.source).toEqual({
      entryId: 'home',
      name: 'Home PC',
      provider: 'compatible',
      model: 'qwen3.6:35b',
    })
    // The source comes before the first words, so they can be labelled.
    expect(reply.events.findIndex((event) => event.type === 'source')).toBe(
      reply.events.findIndex((event) => event.type !== 'usage'),
    )
    expect(laptop.calls).toHaveLength(0)
    expect(last('home')).toMatchObject({ state: 'up' })
    // Counted against that server, not "compatible" as a whole.
    expect(recordUsage).toHaveBeenCalledWith(
      'compatible@home',
      'qwen3.6:35b',
      expect.any(Object),
    )
  })

  it('goes to the next when the first is off, and remembers that for a minute', async () => {
    const pc = createMockProvider({ modelsError: offline() })
    const laptop = createMockProvider({
      replies: [{ chunks: ['From the Mac'] }],
    })
    const { client, last, advance } = setup({
      chain: [home, mac],
      providers: { [HOME]: pc, [MAC]: laptop },
    })
    const first = await read(client.chat(ask))
    expect(first.text).toBe('From the Mac')
    expect(first.source?.name).toBe('Mac')
    expect(pc.calls).toHaveLength(0)
    expect(last('home')).toMatchObject({ state: 'down', kind: 'network' })

    // Within the minute it isn't checked again.
    advance(30_000)
    await read(client.chat(ask))
    expect(pc.listCalls).toBe(1)
    // After it, it is.
    advance(31_000)
    await read(client.chat(ask))
    expect(pc.listCalls).toBe(2)
  })

  it('counts a health check that takes too long as down', async () => {
    const pc = createMockProvider({ modelsDelayMs: 500 })
    const laptop = createMockProvider({
      replies: [{ chunks: ['From the Mac'] }],
    })
    const { client, last } = setup({
      chain: [home, mac],
      providers: { [HOME]: pc, [MAC]: laptop },
    })
    const reply = await read(client.chat(ask))
    expect(reply.text).toBe('From the Mac')
    expect(last('home')).toMatchObject({ state: 'down', kind: 'timeout' })
  })

  it('treats a server that answers its health check at all as up', async () => {
    // `/models` missing (an old server) isn't the server being down.
    const pc = createMockProvider({
      modelsError: new AiError('not-found', 'No such page', { status: 404 }),
      replies: [{ chunks: ['From the PC'] }],
    })
    const { client } = setup({
      chain: [home, mac],
      providers: { [HOME]: pc, [MAC]: createMockProvider() },
    })
    expect((await read(client.chat(ask))).text).toBe('From the PC')
  })

  it('goes to the next when the first doesn’t start answering in time', async () => {
    const pc = createMockProvider({
      replies: [{ delayMs: 400, chunks: ['Too late'] }],
    })
    const laptop = createMockProvider({
      replies: [{ chunks: ['From the Mac'] }],
    })
    const { client, last } = setup({
      chain: [home, mac],
      providers: { [HOME]: pc, [MAC]: laptop },
    })
    const reply = await read(client.chat(ask))
    expect(reply.text).toBe('From the Mac')
    expect(last('home')).toMatchObject({ state: 'down', kind: 'timeout' })
    // Its request was stopped, not left running.
    expect(pc.calls[0].signal?.aborted).toBe(true)
  })

  it('waits longer for the first word when the model may think', async () => {
    const slow = () =>
      createMockProvider({
        replies: [{ delayMs: 80, chunks: ['Thought it over'] }],
      })
    // Thinking off: 40 ms, so the PC is passed over.
    const off = setup({
      chain: [home, mac],
      providers: { [HOME]: slow(), [MAC]: createMockProvider() },
    })
    expect(
      (await read(off.client.chat({ ...ask, feature: 'ask' }))).source?.name,
    ).toBe('Mac')
    // Thinking on for Ask: 150 ms, so it answers.
    const on = setup({
      chain: [home, mac],
      providers: { [HOME]: slow(), [MAC]: createMockProvider() },
      thinking: { ask: true },
    })
    const reply = await read(on.client.chat({ ...ask, feature: 'ask' }))
    expect(reply.text).toBe('Thought it over')
  })

  it('counts thinking as having started', async () => {
    const pc = createMockProvider({
      replies: [{ thinking: 1, chunks: ['Answer'] }],
    })
    const { client } = setup({
      chain: [home, mac],
      providers: { [HOME]: pc, [MAC]: createMockProvider() },
      thinking: { ask: true },
    })
    expect((await read(client.chat({ ...ask, feature: 'ask' }))).text).toBe(
      'Answer',
    )
  })

  it('keeps what came when a reply breaks part way, and offers the next', async () => {
    const pc = createMockProvider({
      replies: [
        {
          chunks: ['The first half', ' and the rest'],
          failAfter: 1,
          error: offline(),
        },
      ],
    })
    const laptop = createMockProvider({ replies: [{ chunks: ['All of it'] }] })
    const { client } = setup({
      chain: [home, mac],
      providers: { [HOME]: pc, [MAC]: laptop },
    })
    const broken = await read(client.chat(ask))
    expect(broken.text).toBe('The first half')
    expect(broken.error).toMatchObject({
      kind: 'network',
      partial: true,
      retryNext: true,
      source: { entryId: 'home', name: 'Home PC' },
    })
    expect(describeAiError(broken.error)).toBe(
      'Home PC stopped part-way through (the connection was lost). What came is kept.',
    )
    // Never started again elsewhere without asking.
    expect(laptop.calls).toHaveLength(0)

    // "Retry with next provider".
    const retried = await read(client.chat({ ...ask, after: 'home' }))
    expect(retried.text).toBe('All of it')
    expect(retried.source?.name).toBe('Mac')
  })

  it('has nothing to offer when the one that broke was the last', async () => {
    const laptop = createMockProvider({
      replies: [{ chunks: ['Half', ' more'], failAfter: 1, error: offline() }],
    })
    const { client } = setup({ chain: [mac], providers: { [MAC]: laptop } })
    const broken = await read(client.chat(ask))
    expect(broken.error).toMatchObject({ partial: true, retryNext: false })
    await expect(
      read(client.chat({ ...ask, after: 'mac' })).then((reply) => reply.error),
    ).resolves.toMatchObject({ kind: 'unavailable' })
  })

  it('doesn’t go to the next for a request that would fail anywhere', async () => {
    const pc = createMockProvider({
      replies: [
        {
          error: new AiError('bad-request', 'The prompt is too long', {
            status: 400,
          }),
        },
      ],
    })
    const laptop = createMockProvider()
    const { client } = setup({
      chain: [home, mac],
      providers: { [HOME]: pc, [MAC]: laptop },
    })
    const reply = await read(client.chat(ask))
    expect(reply.error).toMatchObject({
      kind: 'bad-request',
      source: { entryId: 'home' },
    })
    expect(laptop.calls).toHaveLength(0)
  })

  it('doesn’t go to the next when it’s cancelled', async () => {
    const pc = createMockProvider({ replies: [{ delayMs: 30, chunks: ['x'] }] })
    const laptop = createMockProvider()
    const { client } = setup({
      chain: [home, mac],
      providers: { [HOME]: pc, [MAC]: laptop },
    })
    const controller = new AbortController()
    setTimeout(() => controller.abort(), 5)
    const reply = await read(client.chat({ ...ask, signal: controller.signal }))
    expect(reply.error).toMatchObject({ kind: 'aborted' })
    expect(laptop.calls).toHaveLength(0)
  })

  it('says why each one couldn’t answer when none could', async () => {
    const { client } = setup({
      chain: [home, mac],
      providers: {
        [HOME]: createMockProvider({ modelsError: offline() }),
        [MAC]: createMockProvider({
          replies: [
            { error: new AiError('server', 'Bad gateway', { status: 502 }) },
          ],
        }),
      },
    })
    const reply = await read(client.chat(ask))
    expect(reply.error?.kind).toBe('unavailable')
    expect(describeAiError(reply.error)).toMatch(
      /^None of your chat providers could answer\. Home PC: Couldn't reach the provider.* Mac: The provider had a problem/,
    )
  })

  it('never sends to a cloud provider below the first unless it’s allowed', async () => {
    const pc = createMockProvider({ modelsError: offline() })
    const cloud = createMockProvider({
      replies: [{ chunks: ['From the cloud'] }],
    })
    const providers = { [HOME]: pc, [ROUTER]: cloud }
    const notAllowed = setup({
      chain: [home, { ...router, fallback: false }],
      providers,
      // The PC is the only one asked, so it's tried as usual.
    })
    pc.chat = async function* () {
      yield* []
      throw offline()
    }
    const refused = await read(notAllowed.client.chat(ask))
    expect(cloud.calls).toHaveLength(0)
    expect(refused.error?.kind).toBe('unavailable')
    expect(describeAiError(refused.error)).toMatch(
      /OpenRouter isn’t allowed as a fallback/,
    )

    const allowed = setup({ chain: [home, router], providers })
    const reply = await read(allowed.client.chat(ask))
    expect(reply.text).toBe('From the cloud')
    expect(reply.source?.name).toBe('OpenRouter')
  })

  it('uses a cloud provider that’s first, allowed or not', () => {
    expect(mayAnswer({ ...router, fallback: false }, 0)).toBe(true)
    expect(mayAnswer({ ...router, fallback: false }, 1)).toBe(false)
    // Your own machines, and this device, are always allowed.
    expect(mayAnswer(mac, 3)).toBe(true)
    expect(
      mayAnswer({ ...mac, id: 'here', provider: 'browser', baseUrl: '' }, 2),
    ).toBe(true)
  })

  it('passes over one that isn’t set up, when others are', async () => {
    const laptop = createMockProvider({
      replies: [{ chunks: ['From the Mac'] }],
    })
    const { client } = setup({
      chain: [{ ...home, model: '' }, mac],
      providers: { [MAC]: laptop },
    })
    expect((await read(client.chat(ask))).text).toBe('From the Mac')
  })

  it('reaches each server with its own key', async () => {
    const cloud = createMockProvider()
    const { client, createProvider } = setup({
      chain: [router],
      providers: { [ROUTER]: cloud },
      keys: { 'chat:router': 'sk-or-test-key' },
    })
    await read(client.chat(ask))
    expect(createProvider).toHaveBeenCalledWith({
      provider: 'compatible',
      apiKey: 'sk-or-test-key',
      baseUrl: ROUTER,
    })
  })

  it('doesn’t check or time the model on this device', async () => {
    const here = createMockProvider({
      replies: [{ delayMs: 120, chunks: ['Here'] }],
    })
    const { client, recordUsage } = setup({
      chain: [
        {
          ...mac,
          id: 'here',
          name: 'This device',
          provider: 'browser',
          baseUrl: '',
          model: '',
        },
        mac,
      ],
      providers: { browser: here, [MAC]: createMockProvider() },
    })
    const reply = await read(client.chat(ask))
    expect(reply.text).toBe('Here')
    expect(here.listCalls).toBe(0)
    expect(recordUsage).not.toHaveBeenCalled()
  })

  it('tests one provider in the list on its own', async () => {
    const pc = createMockProvider({ modelsError: offline() })
    const laptop = createMockProvider({ replies: [{ chunks: ['ready'] }] })
    const { client } = setup({
      chain: [home, mac],
      providers: { [HOME]: pc, [MAC]: laptop },
    })
    const result = await client.testConnection('chat', undefined, {
      entryId: 'mac',
    })
    expect(result).toMatchObject({
      ok: true,
      reply: 'ready',
      source: { entryId: 'mac' },
    })
    expect(pc.calls).toHaveLength(0)
  })

  it('checks every server in the list, for Settings', async () => {
    const { client, last } = setup({
      chain: [home, mac],
      providers: {
        [HOME]: createMockProvider({ modelsError: offline() }),
        [MAC]: createMockProvider({ models: [{ id: 'qwen3.5:4b' }] }),
      },
    })
    await client.checkChain()
    expect(last('home')).toMatchObject({ state: 'down' })
    expect(last('mac')).toMatchObject({ state: 'up', models: ['qwen3.5:4b'] })
  })
})

describe('OpenRouter’s free models', () => {
  const catalog = [
    { id: 'meta-llama/llama-3.3-8b-instruct:free' },
    { id: 'openai/gpt-4o' },
    { id: 'qwen/qwen3-14b:free' },
    { id: 'qwen/qwen3-8b:free' },
    { id: 'openrouter/auto' },
    { id: 'z-ai/glm-4.5-air:free' },
  ]

  it('stands in two more free ones from the live list, the same maker first', () => {
    expect(freeFallbacks('qwen/qwen3-8b:free', catalog)).toEqual([
      'qwen/qwen3-14b:free',
      'meta-llama/llama-3.3-8b-instruct:free',
    ])
    // A paid model is chosen on purpose: nothing stands in.
    expect(freeFallbacks('openai/gpt-4o', catalog)).toEqual([])
  })

  it('sends them with the request, and says which one answered', async () => {
    const cloud = createMockProvider({
      models: catalog,
      replies: [{ model: 'qwen/qwen3-14b:free', chunks: ['Stood in'] }],
    })
    const { client } = setup({
      chain: [router],
      providers: { [ROUTER]: cloud },
    })
    const reply = await read(client.chat(ask))
    expect(cloud.calls[0].fallbackModels).toEqual([
      'qwen/qwen3-14b:free',
      'meta-llama/llama-3.3-8b-instruct:free',
    ])
    expect(reply.source?.model).toBe('qwen/qwen3-14b:free')
  })

  it('waits out the per-minute limit, until the reset it gives', async () => {
    const now = 1_700_000_000_000
    const limited = openRouterLimit(
      new AiError('rate-limit', 'Rate limit exceeded: free-models-per-min.', {
        status: 429,
      }),
      {
        body: {
          message: 'Rate limit exceeded: free-models-per-min.',
          code: 429,
          metadata: {
            headers: {
              'X-RateLimit-Limit': '20',
              'X-RateLimit-Remaining': '0',
              'X-RateLimit-Reset': String(now + 12_000),
            },
          },
        },
      },
      now,
    )
    expect(limited).toMatchObject({ kind: 'rate-limit', retryAfterMs: 12_000 })

    // And it is waited out, even with another provider to go to (a short
    // wait here: the provider's pause runs on the real clock).
    const cloud = createMockProvider({
      replies: [
        { error: limited.with({ retryAfterMs: 20 }) },
        { chunks: ['After the wait'] },
      ],
    })
    const laptop = createMockProvider()
    const { client, sleep } = setup({
      chain: [router, mac],
      providers: { [ROUTER]: cloud, [MAC]: laptop },
    })
    const reply = await read(client.chat(ask))
    expect(reply.text).toBe('After the wait')
    expect(sleep).toHaveBeenCalledWith(20, undefined)
    expect(laptop.calls).toHaveLength(0)
  })

  it('doesn’t retry the daily limit: it says so, and the next provider answers', async () => {
    const daily = openRouterLimit(
      new AiError(
        'rate-limit',
        'Rate limit exceeded: free-models-per-day. Add 10 credits to unlock 1000 free model requests per day',
        { status: 429 },
      ),
      {},
    )
    expect(daily.kind).toBe('quota')
    expect(describeAiError(daily)).toBe(
      'Daily free limit reached, resets tomorrow.',
    )

    const cloud = createMockProvider({ replies: [{ error: daily }] })
    const alone = setup({ chain: [router], providers: { [ROUTER]: cloud } })
    const reply = await read(alone.client.chat(ask))
    expect(cloud.calls).toHaveLength(1)
    expect(describeAiError(reply.error)).toBe(
      'Daily free limit reached, resets tomorrow.',
    )

    const laptop = createMockProvider({
      replies: [{ chunks: ['From the Mac'] }],
    })
    const chained = setup({
      chain: [router, mac],
      providers: {
        [ROUTER]: createMockProvider({ replies: [{ error: daily }] }),
        [MAC]: laptop,
      },
    })
    expect((await read(chained.client.chat(ask))).text).toBe('From the Mac')
  })
})

describe('the list itself', () => {
  it('tells your own machines from the cloud', () => {
    for (const address of [
      'http://localhost:11434/v1',
      'http://127.0.0.1:1234/v1',
      'https://pc.tail1234.ts.net/v1',
      'http://192.168.1.20:11434',
      'http://10.0.0.5:8000/v1',
      'http://100.101.102.103:11434',
      'http://gaming-pc:11434',
      'http://studio.local:11434',
      'http://[::1]:11434',
    ])
      expect(isPrivateAddress(address), address).toBe(true)
    for (const address of [
      'https://openrouter.ai/api/v1',
      'https://api.groq.com/openai/v1',
      'http://8.8.8.8/v1',
      'http://172.32.0.1/v1',
      'not a url',
    ])
      expect(isPrivateAddress(address), address).toBe(false)
  })

  it('passes over failures that are about one provider, not ones about the request', () => {
    for (const kind of [
      'network',
      'timeout',
      'server',
      'overloaded',
      'not-found',
      'memory',
    ] as const)
      expect(failsOver(new AiError(kind, 'x')), kind).toBe(true)
    for (const kind of ['bad-request', 'aborted', 'unknown'] as const)
      expect(failsOver(new AiError(kind, 'x')), kind).toBe(false)
  })

  it('reads a saved list, dropping what can’t be read', () => {
    expect(
      parseChain([
        home,
        { ...home, name: 'A copy' },
        { id: 'x', provider: 'nonsense' },
        { ...router, fallback: 'yes', keyName: 42 },
      ]),
    ).toEqual([home, { ...router, fallback: false }])
    expect(parseChain([])).toBeNull()
    expect(parseChain('nope')).toBeNull()
  })

  it('keeps the usage history of the server from before the list', () => {
    const [legacy] = migrateChat(
      { provider: 'compatible', models: { compatible: 'qwen3.5:4b' } },
      MAC,
    )
    expect(usageProviderOf(legacy)).toBe('compatible')
    expect(usageProviderOf(home)).toBe('compatible@home')
    expect(usageProviderOf({ ...home, provider: 'anthropic' })).toBe(
      'anthropic',
    )
    expect(usageLabel('compatible@home', [home])).toBe('Home PC')
    expect(usageLabel('compatible@gone', [home])).toBe('A removed server')
    expect(usageLabel('openai', [home])).toBe('OpenAI')
  })

  it('says where chat goes: "Home PC offline, using Mac"', () => {
    const at = 0
    expect(describeRoute([home, mac], {}).text).toBe('Using Home PC')
    expect(
      describeRoute([home, mac], {
        home: { state: 'down', at, kind: 'network' },
      }).text,
    ).toBe('Home PC offline, using Mac')
    expect(
      describeRoute([home, mac, router], {
        home: { state: 'down', at, kind: 'network' },
        mac: { state: 'down', at, kind: 'overloaded' },
      }).text,
    ).toBe('Home PC offline, Mac busy, using OpenRouter')
    expect(
      describeRoute([home, { ...router, fallback: false }], {
        home: { state: 'down', at, kind: 'timeout' },
      }).text,
    ).toBe('Home PC offline: no other provider to use')
    // One that isn't set up isn't where it goes.
    expect(
      describeRoute([home, mac], {}, (entry) => entry.id !== 'home').text,
    ).toBe('Using Mac')
  })

  it('names where a request may go, in order, leaving out what isn’t allowed', () => {
    expect(
      chatRoute([home, { ...router, fallback: false }, mac], () => true),
    ).toEqual({ first: home, fallbacks: [mac] })
  })
})
