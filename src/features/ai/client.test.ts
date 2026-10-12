import { describe, expect, it, vi } from 'vitest'
import {
  createAiClient,
  EMBED_BATCH,
  replyLength,
  THINKING_ROOM,
  type AiClientDeps,
} from './client'
import type { ChatEntry } from './chain'
import { AiError, describeAiError } from './errors'
import { noteRefusal } from './lib/reach'
import { createMockProvider, type MockProviderOptions } from './providers/mock'
import { DEFAULT_AI_SETTINGS, type AiSettings } from './store'

/** One of chat's providers, for a test. */
function entry(
  fields: Partial<ChatEntry> & Pick<ChatEntry, 'provider'>,
): ChatEntry {
  return {
    id: fields.provider,
    name: fields.id ?? fields.provider,
    baseUrl: '',
    model: '',
    fallback: false,
    ...fields,
  }
}

function setup(
  options: {
    settings?: Partial<AiSettings>
    keys?: Partial<Record<string, string>>
    mock?: MockProviderOptions
  } = {},
) {
  const settings: AiSettings = {
    ...DEFAULT_AI_SETTINGS,
    chat: { chain: [entry({ provider: 'anthropic', model: 'claude-test' })] },
    embeddings: { provider: 'openai', models: { openai: 'embed-test' } },
    ...options.settings,
  }
  const keys = options.keys ?? { anthropic: 'sk-ant-test', openai: 'sk-test' }
  const provider = createMockProvider(options.mock)
  const recordUsage = vi.fn()
  const createProvider = vi.fn(() => provider)
  const deps: AiClientDeps = {
    getSettings: () => settings,
    getKey: async (id) => keys[id],
    createProvider,
    recordUsage,
    retry: { sleep: async () => {}, random: () => 0.5 },
  }
  return { client: createAiClient(deps), provider, recordUsage, createProvider }
}

describe('AI client', () => {
  it('streams a reply from the chosen provider and counts the tokens', async () => {
    const { client, provider, recordUsage, createProvider } = setup({
      mock: {
        replies: [
          {
            chunks: ['Hello', ' there'],
            usage: { inputTokens: 20, outputTokens: 4 },
          },
        ],
      },
    })
    const text: string[] = []
    for await (const event of client.chat({
      messages: [{ role: 'user', content: 'Hi' }],
      system: 'Be kind.',
    })) {
      if (event.type === 'text') text.push(event.text)
    }
    expect(text.join('')).toBe('Hello there')
    expect(createProvider).toHaveBeenCalledWith({
      provider: 'anthropic',
      apiKey: 'sk-ant-test',
    })
    expect(provider.calls[0]).toMatchObject({
      model: 'claude-test',
      system: 'Be kind.',
    })
    expect(recordUsage).toHaveBeenCalledWith('anthropic', 'claude-test', {
      inputTokens: 20,
      outputTokens: 4,
    })
  })

  it('asks for a key when the provider needs one', async () => {
    const { client } = setup({ keys: {} })
    await expect(client.complete({ messages: [] })).rejects.toMatchObject({
      kind: 'no-key',
    })
  })

  it('asks for a model when none is chosen', async () => {
    const { client } = setup({
      settings: { chat: { chain: [entry({ provider: 'anthropic' })] } },
    })
    await expect(client.complete({ messages: [] })).rejects.toMatchObject({
      kind: 'no-model',
    })
  })

  it('reaches a compatible server without a key', async () => {
    const { client, createProvider } = setup({
      keys: {},
      settings: {
        chat: {
          chain: [
            entry({
              provider: 'compatible',
              model: 'llama-test',
              baseUrl: 'http://localhost:11434/v1',
            }),
          ],
        },
      },
    })
    const { text } = await client.complete({
      messages: [{ role: 'user', content: 'Hi' }],
    })
    expect(text).toBe('Mock reply to: Hi')
    expect(createProvider).toHaveBeenCalledWith({
      provider: 'compatible',
      apiKey: undefined,
      baseUrl: 'http://localhost:11434/v1',
    })
  })

  it('retries a busy provider and tells the caller', async () => {
    const onRetry = vi.fn()
    const { client, provider } = setup({
      mock: {
        replies: [
          { error: new AiError('overloaded', 'Overloaded') },
          { chunks: ['Done'] },
        ],
      },
    })
    const result = await client.complete({
      messages: [{ role: 'user', content: 'Hi' }],
      onRetry,
    })
    expect(result).toMatchObject({ text: 'Done', stopReason: 'end' })
    expect(provider.calls).toHaveLength(2)
    expect(onRetry).toHaveBeenCalledWith(
      expect.objectContaining({ attempt: 1 }),
    )
  })

  it('passes on a failure part-way through a reply, still counting what was used', async () => {
    const { client, provider, recordUsage } = setup({
      mock: {
        replies: [
          {
            chunks: ['Half', ' a reply'],
            failAfter: 1,
            error: new AiError('overloaded', 'Overloaded'),
            usage: { inputTokens: 30, outputTokens: 10 },
          },
        ],
      },
    })
    await expect(
      client.complete({ messages: [{ role: 'user', content: 'Hi' }] }),
    ).rejects.toMatchObject({
      kind: 'overloaded',
    })
    expect(provider.calls).toHaveLength(1)
    expect(recordUsage).toHaveBeenCalledWith('anthropic', 'claude-test', {
      inputTokens: 30,
      outputTokens: 0,
    })
  })

  it('stops when cancelled', async () => {
    const controller = new AbortController()
    const { client } = setup({
      mock: { replies: [{ chunks: ['a', 'b', 'c'] }] },
    })
    const seen: string[] = []
    await expect(
      (async () => {
        for await (const event of client.chat({
          messages: [{ role: 'user', content: 'Hi' }],
          signal: controller.signal,
        })) {
          if (event.type !== 'text') continue
          seen.push(event.text)
          controller.abort()
        }
      })(),
    ).rejects.toMatchObject({ kind: 'aborted' })
    expect(seen).toEqual(['a'])
  })

  it('embeds in batches and counts each batch', async () => {
    const { client, provider, recordUsage } = setup()
    const texts = Array.from(
      { length: EMBED_BATCH * 2 + 3 },
      (_, index) => `text ${index}`,
    )
    const vectors = await client.embed(texts)
    expect(vectors).toHaveLength(texts.length)
    expect(provider.embedCalls.map((call) => call.input.length)).toEqual([
      EMBED_BATCH,
      EMBED_BATCH,
      3,
    ])
    expect(recordUsage).toHaveBeenCalledTimes(3)
    expect(await client.embed([])).toEqual([])
  })

  it('tests a connection without throwing', async () => {
    const ok = await setup({
      mock: { replies: [{ chunks: ['Ready'] }] },
    }).client.testConnection('chat')
    expect(ok).toMatchObject({
      ok: true,
      provider: 'anthropic',
      model: 'claude-test',
      reply: 'Ready',
    })

    const embeddings = await setup().client.testConnection('embeddings')
    expect(embeddings).toMatchObject({ ok: true, dimensions: 8 })

    const failing = setup({
      mock: { replies: [{ error: new AiError('auth', 'invalid x-api-key') }] },
    })
    const result = await failing.client.testConnection('chat')
    expect(result).toMatchObject({ ok: false })
    expect(result.error?.kind).toBe('auth')
    // A test is one honest try, not a retry loop.
    expect(failing.provider.calls).toHaveLength(1)
  })

  it('transcribes with the chosen model, counting tokens only when given', async () => {
    const { client, provider, recordUsage, createProvider } = setup({
      settings: {
        transcription: {
          provider: 'openai',
          models: { openai: 'whisper-test' },
        },
      },
      mock: { transcript: 'Karnaugh maps group the ones.' },
    })
    const audio = new Blob(['sound'], { type: 'audio/webm' })
    expect(
      await client.transcribe(audio, {
        fileName: 'recording.webm',
        language: 'en',
      }),
    ).toBe('Karnaugh maps group the ones.')
    expect(createProvider).toHaveBeenCalledWith({
      provider: 'openai',
      apiKey: 'sk-test',
    })
    expect(provider.transcribeCalls[0]).toMatchObject({
      model: 'whisper-test',
      audio,
      fileName: 'recording.webm',
      language: 'en',
    })
    // Whisper reports no tokens, so there's nothing to count.
    expect(recordUsage).not.toHaveBeenCalled()
  })

  it('asks for a transcription model when none is chosen', async () => {
    const { client } = setup()
    await expect(
      client.transcribe(new Blob(['x']), { fileName: 'a.webm' }),
    ).rejects.toMatchObject({
      kind: 'no-model',
      message: 'Choose a transcription model in Settings → AI.',
    })
  })

  it('tests a transcription connection with a second of silence', async () => {
    const { client, provider } = setup({
      settings: {
        transcription: {
          provider: 'openai',
          models: { openai: 'whisper-test' },
        },
      },
      mock: { transcript: '' },
    })
    expect(await client.testConnection('transcription')).toMatchObject({
      ok: true,
      model: 'whisper-test',
      reply: '',
    })
    const [call] = provider.transcribeCalls
    expect(call.fileName).toBe('silence.wav')
    expect(call.audio.type).toBe('audio/wav')
  })

  it('lists a provider’s models', async () => {
    const { client } = setup({
      mock: { models: [{ id: 'one' }, { id: 'two' }] },
    })
    expect(await client.listModels('openai')).toEqual([
      { id: 'one' },
      { id: 'two' },
    ])
  })
})

describe('thinking and the reply cap', () => {
  const ask = { messages: [{ role: 'user' as const, content: 'Hi' }] }

  it('asks models not to think, unless the feature’s switch is on', async () => {
    const { client, provider } = setup({
      settings: {
        thinking: { ...DEFAULT_AI_SETTINGS.thinking, quizzes: true },
      },
    })
    await client.complete({ ...ask, feature: 'ask' })
    await client.complete({ ...ask, feature: 'quizzes' })
    // A request that doesn't say what it's for is treated as off.
    await client.complete(ask)
    expect(provider.calls.map((call) => call.thinking)).toEqual([
      false,
      true,
      false,
    ])
  })

  it('caps every reply at the limit in Settings, with room to think', async () => {
    const { client, provider } = setup({
      settings: {
        maxReplyTokens: 4096,
        thinking: { ...DEFAULT_AI_SETTINGS.thinking, ask: true },
      },
    })
    await client.complete({ ...ask, maxTokens: 700, feature: 'summaries' })
    await client.complete({ ...ask, maxTokens: 700, feature: 'ask' })
    await client.complete({ ...ask, maxTokens: 8000, feature: 'photos' })
    // A request with no length of its own still gets the cap.
    await client.complete(ask)
    expect(provider.calls.map((call) => call.maxTokens)).toEqual([
      700, 4096, 4096, 4096,
    ])
    expect(replyLength({ maxReplyTokens: 32_768 }, 700, true)).toBe(
      700 + THINKING_ROOM,
    )
  })

  it('keeps a reply cut off at the limit, and says so', async () => {
    const { client } = setup({
      mock: {
        replies: [{ chunks: ['Half an an'], stopReason: 'max-tokens' }],
      },
    })
    expect(await client.complete(ask)).toMatchObject({
      text: 'Half an an',
      stopReason: 'max-tokens',
    })
  })

  it('says when the model starts thinking and when its reply starts', async () => {
    const { client } = setup({
      mock: { replies: [{ thinking: 3, chunks: ['A', 'B'] }] },
    })
    const phases: string[] = []
    const events: string[] = []
    for await (const event of client.chat({
      ...ask,
      onProgress: (phase) => phases.push(phase),
    }))
      events.push(event.type)
    expect(phases).toEqual(['thinking', 'writing'])
    expect(events.filter((type) => type === 'thinking')).toHaveLength(3)
    // Thinking isn't text: complete() returns only the answer.
    const { client: again } = setup({
      mock: { replies: [{ thinking: 2, chunks: ['Answer'] }] },
    })
    expect((await again.complete(ask)).text).toBe('Answer')
  })

  it('tests a connection without thinking, whatever the switches say', async () => {
    const { client, provider } = setup({
      settings: {
        thinking: {
          ask: true,
          cards: true,
          quizzes: true,
          summaries: true,
          planning: true,
          photos: true,
        },
      },
    })
    expect((await client.testConnection('chat')).ok).toBe(true)
    expect(provider.calls[0]).toMatchObject({ thinking: false, maxTokens: 512 })
  })
})

describe('what the browser won’t send', () => {
  const compatible = (baseUrl: string) => ({
    chat: {
      chain: [entry({ provider: 'compatible', model: 'qwen3.5:4b', baseUrl })],
    },
    compatibleBaseUrl: baseUrl,
  })

  it('says, before sending, that Safari won’t reach http from an https page', async () => {
    const createProvider = vi.fn(() => createMockProvider())
    const client = createAiClient({
      getSettings: () => ({
        ...DEFAULT_AI_SETTINGS,
        ...compatible('http://localhost:11434'),
      }),
      getKey: async () => undefined,
      createProvider,
      recordUsage: vi.fn(),
      page: () => ({
        origin: 'https://momentum.example.com',
        webkit: true,
        installed: true,
      }),
    })
    const error = await client
      .listModels('compatible')
      .catch((caught: unknown) => caught)
    expect(error).toMatchObject({ kind: 'blocked' })
    expect(describeAiError(error)).toMatch(
      /Safari won't send anything .*https:\/\/momentum\.example\.com.*http:\/\/localhost:11434\/v1/,
    )
    expect(await client.testConnection('chat')).toMatchObject({
      ok: false,
      error: { kind: 'blocked' },
    })
    // Nothing was sent: no provider was even made.
    expect(createProvider).not.toHaveBeenCalled()
  })

  it('names the page’s origin when a compatible server can’t be reached', async () => {
    const provider = createMockProvider({
      replies: [{ error: new AiError('network', 'Load failed') }],
    })
    const client = createAiClient({
      getSettings: () => ({
        ...DEFAULT_AI_SETTINGS,
        ...compatible('http://localhost:11434/v1'),
      }),
      getKey: async () => undefined,
      createProvider: () => provider,
      recordUsage: vi.fn(),
      retry: { sleep: async () => {}, random: () => 0.5, attempts: 1 },
      page: () => ({
        origin: 'http://localhost:4173',
        webkit: true,
        installed: true,
      }),
    })
    const error = await client
      .complete({ messages: [] })
      .catch((caught: unknown) => caught)
    expect(error).toMatchObject({ kind: 'network' })
    expect(describeAiError(error)).toBe(
      "Couldn't reach the provider. Check that the server is running at http://localhost:11434/v1, and that it allows requests from http://localhost:4173, where this copy of Momentum is open (for Ollama, OLLAMA_ORIGINS=http://localhost:4173).",
    )
  })

  it('says when the page’s own policy refused the request', async () => {
    noteRefusal('http://localhost:11434/v1/chat/completions')
    const provider = createMockProvider({
      replies: [{ error: new AiError('network', 'Load failed') }],
    })
    const client = createAiClient({
      getSettings: () => ({
        ...DEFAULT_AI_SETTINGS,
        ...compatible('http://localhost:11434/v1'),
      }),
      getKey: async () => undefined,
      createProvider: () => provider,
      recordUsage: vi.fn(),
      retry: { sleep: async () => {}, random: () => 0.5, attempts: 1 },
      page: () => ({
        origin: 'http://localhost:4173',
        webkit: false,
        installed: false,
      }),
    })
    const error = await client
      .complete({ messages: [] })
      .catch((caught: unknown) => caught)
    expect(error).toMatchObject({ kind: 'blocked' })
    expect(describeAiError(error)).toMatch(
      /Content Security Policy \(connect-src\) doesn't allow http:\/\/localhost:11434/,
    )
  })
})

describe('chat on this device', () => {
  const onDevice = {
    chat: { chain: [entry({ provider: 'browser' })] },
  }

  it('uses the recommended model unless another is chosen, and counts no usage', async () => {
    const { client, provider, recordUsage, createProvider } = setup({
      settings: onDevice,
      keys: {},
    })
    await client.complete({ messages: [{ role: 'user', content: 'Hi' }] })
    expect(createProvider).toHaveBeenCalledWith({ provider: 'browser' })
    expect(provider.calls[0].model).toBe('qwen3.5-2b')
    expect(recordUsage).not.toHaveBeenCalled()
  })

  it('tests the connection with a short reply, timing the first words and the speed', async () => {
    const slow = {
      ...createMockProvider(),
      async *chat() {
        await new Promise((resolve) => setTimeout(resolve, 20))
        yield { type: 'text' as const, text: '1 2 3' }
        await new Promise((resolve) => setTimeout(resolve, 40))
        yield { type: 'text' as const, text: ' 4 5' }
        yield {
          type: 'usage' as const,
          usage: { inputTokens: 20, outputTokens: 11 },
        }
        yield { type: 'done' as const, stopReason: 'end' as const }
      },
    }
    const client = createAiClient({
      getSettings: () => ({ ...DEFAULT_AI_SETTINGS, ...onDevice }),
      getKey: async () => undefined,
      createProvider: () => slow,
      recordUsage: vi.fn(),
    })
    const result = await client.testConnection('chat')
    expect(result).toMatchObject({ ok: true, reply: '1 2 3 4 5' })
    expect(result.firstTokenMs).toBeGreaterThanOrEqual(15)
    // Ten tokens after the first, in about 40 ms.
    expect(result.tokensPerSecond).toBeGreaterThan(50)
    expect(result.tokensPerSecond).toBeLessThan(1000)
  })
})
