import * as OpenAiSdk from 'openai'
import { describe, expect, it } from 'vitest'
import type { ChatEvent } from '../types'
import { createOpenAiProvider, normalizeBaseUrl } from './openai'

type Sdk = typeof OpenAiSdk

/** A stand-in for the OpenAI client: same shape, no network. */
function fakeSdk(
  options: { chunks?: object[]; embeddings?: object; models?: object[] } = {},
) {
  const constructed: Array<Record<string, unknown>> = []
  const chatBodies: Array<Record<string, unknown>> = []
  const embedBodies: Array<Record<string, unknown>> = []
  const controller = new AbortController()

  class FakeOpenAI {
    constructor(clientOptions: Record<string, unknown>) {
      constructed.push(clientOptions)
    }
    chat = {
      completions: {
        create: async (
          body: Record<string, unknown>,
          requestOptions: { signal?: AbortSignal } = {},
        ) => {
          chatBodies.push(body)
          // Like the SDK: the caller's signal cancels the stream, which then
          // ends without an error.
          requestOptions.signal?.addEventListener('abort', () =>
            controller.abort(),
          )
          return {
            controller,
            async *[Symbol.asyncIterator]() {
              for (const chunk of options.chunks ?? []) {
                if (controller.signal.aborted) return
                yield chunk
              }
            },
          }
        },
      },
    }
    embeddings = {
      create: async (body: Record<string, unknown>) => {
        embedBodies.push(body)
        return options.embeddings
      },
    }
    models = {
      list: () =>
        (async function* () {
          yield* options.models ?? []
        })(),
    }
  }

  const sdk = { ...OpenAiSdk, default: FakeOpenAI } as unknown as Sdk
  return {
    loadSdk: async () => sdk,
    constructed,
    chatBodies,
    embedBodies,
    controller,
  }
}

const chunk = (
  content: string | null,
  finish: string | null = null,
  extra: object = {},
) => ({
  choices: [{ index: 0, delta: { content, ...extra }, finish_reason: finish }],
})

async function collect(stream: AsyncIterable<ChatEvent>): Promise<ChatEvent[]> {
  const events: ChatEvent[] = []
  for await (const event of stream) events.push(event)
  return events
}

describe('OpenAI provider', () => {
  it('streams text and the usage sent in the final chunk', async () => {
    const fake = fakeSdk({
      chunks: [
        chunk('Hel'),
        chunk('lo', 'stop'),
        {
          choices: [],
          usage: { prompt_tokens: 9, completion_tokens: 2, total_tokens: 11 },
        },
      ],
    })
    const provider = createOpenAiProvider({
      id: 'openai',
      apiKey: 'sk-test',
      loadSdk: fake.loadSdk,
    })
    const events = await collect(
      provider.chat({
        model: 'gpt-test',
        system: 'Be brief.',
        messages: [{ role: 'user', content: 'Hi' }],
        maxTokens: 50,
      }),
    )
    expect(events).toEqual([
      { type: 'text', text: 'Hel' },
      { type: 'text', text: 'lo' },
      { type: 'usage', usage: { inputTokens: 9, outputTokens: 2 } },
      { type: 'done', stopReason: 'end' },
    ])
    expect(fake.chatBodies[0]).toMatchObject({
      model: 'gpt-test',
      stream: true,
      stream_options: { include_usage: true },
      max_completion_tokens: 50,
      messages: [
        { role: 'system', content: 'Be brief.' },
        { role: 'user', content: 'Hi' },
      ],
    })
    expect(fake.constructed[0]).toMatchObject({
      apiKey: 'sk-test',
      dangerouslyAllowBrowser: true,
      maxRetries: 0,
    })
  })

  it('reports length cut-offs and refusals', async () => {
    const cut = fakeSdk({ chunks: [chunk('Long', 'length')] })
    const cutEvents = await collect(
      createOpenAiProvider({
        id: 'openai',
        apiKey: 'k',
        loadSdk: cut.loadSdk,
      }).chat({ model: 'm', messages: [] }),
    )
    expect(cutEvents.at(-1)).toEqual({ type: 'done', stopReason: 'max-tokens' })

    const refused = fakeSdk({
      chunks: [chunk(null, 'stop', { refusal: "I can't help with that." })],
    })
    const refusedEvents = await collect(
      createOpenAiProvider({
        id: 'openai',
        apiKey: 'k',
        loadSdk: refused.loadSdk,
      }).chat({ model: 'm', messages: [] }),
    )
    expect(refusedEvents).toContainEqual({
      type: 'text',
      text: "I can't help with that.",
    })
    expect(refusedEvents.at(-1)).toEqual({
      type: 'done',
      stopReason: 'refusal',
    })
  })

  it('reaches compatible servers at their address, with or without a key', async () => {
    const fake = fakeSdk({ chunks: [chunk('ok', 'stop')] })
    await collect(
      createOpenAiProvider({
        id: 'compatible',
        baseUrl: 'http://localhost:11434',
        loadSdk: fake.loadSdk,
      }).chat({
        model: 'llama-test',
        messages: [{ role: 'user', content: 'Hi' }],
        maxTokens: 20,
      }),
    )
    expect(fake.constructed[0]).toMatchObject({
      baseURL: 'http://localhost:11434/v1',
      apiKey: 'not-needed',
    })
    // Compatible servers get the widely supported name for the length cap.
    expect(fake.chatBodies[0]).toMatchObject({ max_tokens: 20 })
    expect(fake.chatBodies[0]).not.toHaveProperty('max_completion_tokens')
  })

  it('cancels the request when the reader stops early', async () => {
    const fake = fakeSdk({ chunks: [chunk('a'), chunk('b'), chunk('c')] })
    for await (const event of createOpenAiProvider({
      id: 'openai',
      apiKey: 'k',
      loadSdk: fake.loadSdk,
    }).chat({
      model: 'm',
      messages: [],
    })) {
      if (event.type === 'text') break
    }
    expect(fake.controller.signal.aborted).toBe(true)
  })

  it('reports a cancelled reply as cancelled, not finished', async () => {
    const fake = fakeSdk({
      chunks: [chunk('a'), chunk('b'), chunk('c', 'stop')],
    })
    const stop = new AbortController()
    const events: ChatEvent[] = []
    const reading = (async () => {
      for await (const event of createOpenAiProvider({
        id: 'openai',
        apiKey: 'k',
        loadSdk: fake.loadSdk,
      }).chat({ model: 'm', messages: [], signal: stop.signal })) {
        events.push(event)
        if (event.type === 'text') stop.abort()
      }
    })()
    await expect(reading).rejects.toMatchObject({ kind: 'aborted' })
    expect(events).toEqual([{ type: 'text', text: 'a' }])
  })

  it('embeds in input order, as floats', async () => {
    const fake = fakeSdk({
      embeddings: {
        data: [
          { index: 1, embedding: [0, 1] },
          { index: 0, embedding: [1, 0] },
        ],
        usage: { prompt_tokens: 6, total_tokens: 6 },
      },
    })
    const result = await createOpenAiProvider({
      id: 'openai',
      apiKey: 'k',
      loadSdk: fake.loadSdk,
    }).embed({
      model: 'embed-test',
      input: ['first', 'second'],
    })
    expect(result).toEqual({
      vectors: [
        [1, 0],
        [0, 1],
      ],
      usage: { inputTokens: 6, outputTokens: 0 },
    })
    expect(fake.embedBodies[0]).toMatchObject({
      encoding_format: 'float',
      input: ['first', 'second'],
    })
  })

  it('lists models alphabetically', async () => {
    const fake = fakeSdk({ models: [{ id: 'zeta' }, { id: 'alpha' }] })
    const models = await createOpenAiProvider({
      id: 'openai',
      apiKey: 'k',
      loadSdk: fake.loadSdk,
    }).listModels()
    expect(models.map((model) => model.id)).toEqual(['alpha', 'zeta'])
  })
})

describe('normalizeBaseUrl', () => {
  it('adds /v1 to a bare server address', () => {
    expect(normalizeBaseUrl('http://localhost:11434')).toBe(
      'http://localhost:11434/v1',
    )
    expect(normalizeBaseUrl('http://localhost:11434/')).toBe(
      'http://localhost:11434/v1',
    )
    expect(normalizeBaseUrl(' https://openrouter.ai/api/v1/ ')).toBe(
      'https://openrouter.ai/api/v1',
    )
    expect(normalizeBaseUrl('http://192.168.1.5:1234/v1')).toBe(
      'http://192.168.1.5:1234/v1',
    )
  })
})
