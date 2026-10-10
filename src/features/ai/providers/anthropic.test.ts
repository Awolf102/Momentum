import * as AnthropicSdk from '@anthropic-ai/sdk'
import { describe, expect, it } from 'vitest'
import type { ChatEvent } from '../types'
import { createAnthropicProvider, DEFAULT_MAX_TOKENS } from './anthropic'

type Sdk = typeof AnthropicSdk

interface FakeOptions {
  events?: object[]
  /** Thrown while streaming, after the events. */
  error?: unknown
  modelLimit?: number | null
  models?: object[]
}

/** A stand-in for the Anthropic client: same shape, no network. */
function fakeSdk(options: FakeOptions = {}) {
  const requests: Array<{
    body: Record<string, unknown>
    signal?: AbortSignal
  }> = []
  const constructed: object[] = []
  let aborted = false

  class FakeAnthropic {
    constructor(clientOptions: object) {
      constructed.push(clientOptions)
    }
    messages = {
      stream(
        body: Record<string, unknown>,
        requestOptions: { signal?: AbortSignal } = {},
      ) {
        requests.push({ body, signal: requestOptions.signal })
        // Like the SDK when no read is waiting: the caller's signal ends the
        // stream without an error.
        requestOptions.signal?.addEventListener('abort', () => {
          aborted = true
        })
        return {
          abort() {
            aborted = true
          },
          async *[Symbol.asyncIterator]() {
            for (const event of options.events ?? []) {
              if (aborted) return
              yield event
            }
            if (options.error) throw options.error
          },
        }
      },
    }
    models = {
      retrieve: async () => ({ max_tokens: options.modelLimit ?? null }),
      list: () =>
        (async function* () {
          yield* options.models ?? []
        })(),
    }
  }

  const sdk = { ...AnthropicSdk, default: FakeAnthropic } as unknown as Sdk
  return {
    loadSdk: async () => sdk,
    requests,
    constructed,
    get aborted() {
      return aborted
    },
  }
}

const reply = (text: string[], stopReason = 'end_turn') => [
  {
    type: 'message_start',
    message: {
      usage: {
        input_tokens: 12,
        cache_creation_input_tokens: 3,
        cache_read_input_tokens: null,
        output_tokens: 1,
      },
    },
  },
  {
    type: 'content_block_start',
    index: 0,
    content_block: { type: 'text', text: '' },
  },
  ...text.map((chunk) => ({
    type: 'content_block_delta',
    index: 0,
    delta: { type: 'text_delta', text: chunk },
  })),
  { type: 'content_block_stop', index: 0 },
  {
    type: 'message_delta',
    delta: { stop_reason: stopReason },
    usage: { input_tokens: null, output_tokens: 7 },
  },
  { type: 'message_stop' },
]

async function collect(stream: AsyncIterable<ChatEvent>): Promise<ChatEvent[]> {
  const events: ChatEvent[] = []
  for await (const event of stream) events.push(event)
  return events
}

describe('Anthropic provider', () => {
  it('streams text, usage and why the reply stopped', async () => {
    const fake = fakeSdk({ events: reply(['Hel', 'lo']) })
    const provider = createAnthropicProvider({
      apiKey: 'sk-ant-test',
      loadSdk: fake.loadSdk,
    })
    const events = await collect(
      provider.chat({
        model: 'claude-test',
        system: 'Be brief.',
        messages: [{ role: 'user', content: 'Hi' }],
      }),
    )
    expect(events).toEqual([
      { type: 'usage', usage: { inputTokens: 15, outputTokens: 1 } },
      { type: 'text', text: 'Hel' },
      { type: 'text', text: 'lo' },
      { type: 'usage', usage: { inputTokens: 15, outputTokens: 7 } },
      { type: 'done', stopReason: 'end' },
    ])
    expect(fake.requests[0].body).toMatchObject({
      model: 'claude-test',
      system: 'Be brief.',
      messages: [{ role: 'user', content: 'Hi' }],
    })
  })

  it('sends pictures as base64 image blocks', async () => {
    const fake = fakeSdk({ events: reply(['ok']) })
    await collect(
      createAnthropicProvider({ apiKey: 'k', loadSdk: fake.loadSdk }).chat({
        model: 'claude-test',
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: 'Photo 1 of 1' },
              { type: 'image', mediaType: 'image/jpeg', data: 'AAAA' },
            ],
          },
        ],
      }),
    )
    expect(fake.requests[0].body.messages).toEqual([
      {
        role: 'user',
        content: [
          { type: 'text', text: 'Photo 1 of 1' },
          {
            type: 'image',
            source: { type: 'base64', media_type: 'image/jpeg', data: 'AAAA' },
          },
        ],
      },
    ])
  })

  it('talks to the API straight from the browser, with retries left to Momentum', async () => {
    const fake = fakeSdk({ events: reply(['ok']) })
    await collect(
      createAnthropicProvider({
        apiKey: 'sk-ant-test',
        loadSdk: fake.loadSdk,
      }).chat({
        model: 'claude-test',
        messages: [{ role: 'user', content: 'Hi' }],
      }),
    )
    expect(fake.constructed[0]).toEqual({
      apiKey: 'sk-ant-test',
      dangerouslyAllowBrowser: true,
      maxRetries: 0,
    })
  })

  it("caps the reply length at the model's own limit", async () => {
    const small = fakeSdk({ events: reply(['ok']), modelLimit: 4096 })
    await collect(
      createAnthropicProvider({ apiKey: 'k', loadSdk: small.loadSdk }).chat({
        model: 'claude-small-limit',
        messages: [{ role: 'user', content: 'Hi' }],
      }),
    )
    expect(small.requests[0].body.max_tokens).toBe(4096)

    const large = fakeSdk({ events: reply(['ok']), modelLimit: 128_000 })
    await collect(
      createAnthropicProvider({ apiKey: 'k', loadSdk: large.loadSdk }).chat({
        model: 'claude-large-limit',
        messages: [{ role: 'user', content: 'Hi' }],
        maxTokens: 1000,
      }),
    )
    expect(large.requests[0].body.max_tokens).toBe(1000)

    const unknown = fakeSdk({ events: reply(['ok']), modelLimit: null })
    await collect(
      createAnthropicProvider({ apiKey: 'k', loadSdk: unknown.loadSdk }).chat({
        model: 'claude-unknown-limit',
        messages: [{ role: 'user', content: 'Hi' }],
      }),
    )
    expect(unknown.requests[0].body.max_tokens).toBe(DEFAULT_MAX_TOKENS)
  })

  it('reports a refusal', async () => {
    const fake = fakeSdk({ events: reply([], 'refusal') })
    const events = await collect(
      createAnthropicProvider({ apiKey: 'k', loadSdk: fake.loadSdk }).chat({
        model: 'claude-refusal',
        messages: [{ role: 'user', content: 'Hi' }],
      }),
    )
    expect(events.at(-1)).toEqual({ type: 'done', stopReason: 'refusal' })
  })

  it('cancels the request when the reader stops early', async () => {
    const fake = fakeSdk({ events: reply(['one', 'two', 'three']) })
    const provider = createAnthropicProvider({
      apiKey: 'k',
      loadSdk: fake.loadSdk,
    })
    for await (const event of provider.chat({
      model: 'claude-cancel',
      messages: [{ role: 'user', content: 'Hi' }],
    })) {
      if (event.type === 'text') break
    }
    expect(fake.aborted).toBe(true)
  })

  it('reports a cancelled reply as cancelled, not finished', async () => {
    const fake = fakeSdk({ events: reply(['one', 'two', 'three']) })
    const stop = new AbortController()
    const texts: string[] = []
    const reading = (async () => {
      for await (const event of createAnthropicProvider({
        apiKey: 'k',
        loadSdk: fake.loadSdk,
      }).chat({
        model: 'test-model',
        messages: [{ role: 'user', content: 'Hi' }],
        signal: stop.signal,
      })) {
        if (event.type === 'done') texts.push('(done)')
        if (event.type !== 'text') continue
        texts.push(event.text)
        stop.abort()
      }
    })()
    await expect(reading).rejects.toMatchObject({ kind: 'aborted' })
    expect(texts).toEqual(['one'])
  })

  it('turns SDK errors into AiErrors', async () => {
    const fake = fakeSdk({
      error: AnthropicSdk.APIError.generate(
        429,
        {
          type: 'error',
          error: { type: 'rate_limit_error', message: 'Slow down' },
        },
        undefined,
        new Headers({ 'retry-after': '4' }),
      ),
    })
    const chat = collect(
      createAnthropicProvider({ apiKey: 'k', loadSdk: fake.loadSdk }).chat({
        model: 'claude-errors',
        messages: [{ role: 'user', content: 'Hi' }],
      }),
    )
    await expect(chat).rejects.toMatchObject({
      name: 'AiError',
      kind: 'rate-limit',
      retryAfterMs: 4000,
    })
  })

  it('says transcription is not available', async () => {
    const fake = fakeSdk()
    await expect(
      createAnthropicProvider({
        apiKey: 'k',
        loadSdk: fake.loadSdk,
      }).transcribe({
        model: 'x',
        audio: new Blob(['x']),
        fileName: 'a.webm',
      }),
    ).rejects.toMatchObject({ kind: 'unsupported' })
  })

  it('says embeddings are not available', async () => {
    const provider = createAnthropicProvider({
      apiKey: 'k',
      loadSdk: fakeSdk().loadSdk,
    })
    await expect(
      provider.embed({ model: 'x', input: ['a'] }),
    ).rejects.toMatchObject({ kind: 'unsupported' })
  })

  it('lists models, leaving out retired ones', async () => {
    const fake = fakeSdk({
      models: [
        {
          id: 'claude-new',
          display_name: 'Claude New',
          max_tokens: 128_000,
          lifecycle: 'active',
        },
        {
          id: 'claude-old',
          display_name: 'Claude Old',
          max_tokens: 8192,
          lifecycle: 'deprecated',
        },
        {
          id: 'claude-gone',
          display_name: 'Claude Gone',
          max_tokens: 4096,
          lifecycle: 'retired',
        },
      ],
    })
    const models = await createAnthropicProvider({
      apiKey: 'k',
      loadSdk: fake.loadSdk,
    }).listModels()
    expect(models).toEqual([
      {
        id: 'claude-new',
        name: 'Claude New',
        maxOutputTokens: 128_000,
        deprecated: false,
      },
      {
        id: 'claude-old',
        name: 'Claude Old',
        maxOutputTokens: 8192,
        deprecated: true,
      },
    ])
  })
})
