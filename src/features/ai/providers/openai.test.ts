import * as OpenAiSdk from 'openai'
import { describe, expect, it } from 'vitest'
import type { ChatEvent } from '../types'
import { createOpenAiProvider, isOpenRouter, normalizeBaseUrl } from './openai'

type Sdk = typeof OpenAiSdk

/** A stand-in for the OpenAI client: same shape, no network. */
function fakeSdk(
  options: {
    chunks?: object[]
    /** Turns a chat request away, as a server can. */
    chatError?: (body: Record<string, unknown>) => Error | undefined
    embeddings?: object
    transcription?: object
    models?: object[]
  } = {},
) {
  const constructed: Array<Record<string, unknown>> = []
  const chatBodies: Array<Record<string, unknown>> = []
  const embedBodies: Array<Record<string, unknown>> = []
  const transcribeBodies: Array<Record<string, unknown>> = []
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
          const refusal = options.chatError?.(body)
          if (refusal) throw refusal
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
    audio = {
      transcriptions: {
        create: async (body: Record<string, unknown>) => {
          transcribeBodies.push(body)
          return options.transcription
        },
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
    transcribeBodies,
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

  it('sends pictures as data URLs, read in detail', async () => {
    const fake = fakeSdk({ chunks: [chunk('ok', 'stop')] })
    await collect(
      createOpenAiProvider({
        id: 'openai',
        apiKey: 'k',
        loadSdk: fake.loadSdk,
      }).chat({
        model: 'gpt-test',
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: 'Photo 1 of 1' },
              { type: 'image', mediaType: 'image/png', data: 'BBBB' },
            ],
          },
          {
            role: 'assistant',
            content: [{ type: 'text', text: 'Earlier reply' }],
          },
        ],
      }),
    )
    expect(fake.chatBodies[0].messages).toEqual([
      {
        role: 'user',
        content: [
          { type: 'text', text: 'Photo 1 of 1' },
          {
            type: 'image_url',
            image_url: { url: 'data:image/png;base64,BBBB', detail: 'high' },
          },
        ],
      },
      // Replies are text only.
      { role: 'assistant', content: 'Earlier reply' },
    ])
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

  it('sends a recording for transcription, with its name and type', async () => {
    const fake = fakeSdk({
      transcription: {
        text: 'Gray code',
        usage: {
          type: 'tokens',
          input_tokens: 40,
          output_tokens: 3,
          total_tokens: 43,
        },
      },
    })
    const provider = createOpenAiProvider({
      id: 'openai',
      apiKey: 'k',
      loadSdk: fake.loadSdk,
    })
    const result = await provider.transcribe({
      model: 'gpt-test-transcribe',
      audio: new Blob(['sound'], { type: 'audio/webm' }),
      fileName: 'recording.webm',
      language: 'en',
    })
    expect(result).toEqual({
      text: 'Gray code',
      usage: { inputTokens: 40, outputTokens: 3 },
    })
    const [body] = fake.transcribeBodies
    expect(body).toMatchObject({
      model: 'gpt-test-transcribe',
      response_format: 'json',
      language: 'en',
    })
    const file = body.file as File
    expect([file.name, file.type, await file.text()]).toEqual([
      'recording.webm',
      'audio/webm',
      'sound',
    ])
    // Billed by the minute (Whisper): no tokens to count.
    const whisper = fakeSdk({
      transcription: { text: 'Hi', usage: { type: 'duration', seconds: 3 } },
    })
    expect(
      await createOpenAiProvider({
        id: 'openai',
        apiKey: 'k',
        loadSdk: whisper.loadSdk,
      }).transcribe({
        model: 'whisper-test',
        audio: new Blob(['x']),
        fileName: 'a.wav',
      }),
    ).toEqual({ text: 'Hi' })
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

describe('thinking', () => {
  const ask = {
    model: 'qwen3.5:4b',
    messages: [{ role: 'user' as const, content: 'Hi' }],
    maxTokens: 100,
  }
  const answer = [chunk('Hi'), chunk(null, 'stop')]

  it('asks a compatible server not to think, the way Ollama documents', async () => {
    const fake = fakeSdk({ chunks: answer })
    const provider = createOpenAiProvider({
      id: 'compatible',
      baseUrl: 'http://localhost:11434/v1',
      loadSdk: fake.loadSdk,
    })
    await collect(provider.chat({ ...ask, thinking: false }))
    expect(fake.chatBodies[0]).toMatchObject({
      reasoning_effort: 'none',
      max_tokens: 100,
    })
    // On: left to the model.
    await collect(provider.chat({ ...ask, thinking: true }))
    expect(fake.chatBodies[1]).not.toHaveProperty('reasoning_effort')
  })

  it('uses OpenRouter’s own switch with OpenRouter', async () => {
    const fake = fakeSdk({ chunks: answer })
    const provider = createOpenAiProvider({
      id: 'compatible',
      baseUrl: 'https://openrouter.ai/api/v1',
      loadSdk: fake.loadSdk,
    })
    await collect(provider.chat({ ...ask, thinking: false }))
    expect(fake.chatBodies[0]).toMatchObject({ reasoning: { effort: 'none' } })
    expect(fake.chatBodies[0]).not.toHaveProperty('reasoning_effort')
    expect(isOpenRouter('https://openrouter.ai/api/v1')).toBe(true)
    expect(isOpenRouter('http://localhost:11434')).toBe(false)
    expect(isOpenRouter('not a url')).toBe(false)
  })

  it('never sends it to OpenAI, whose models decide for themselves', async () => {
    const fake = fakeSdk({ chunks: answer })
    const provider = createOpenAiProvider({
      id: 'openai',
      apiKey: 'sk-test',
      loadSdk: fake.loadSdk,
    })
    await collect(provider.chat({ ...ask, thinking: false }))
    expect(fake.chatBodies[0]).not.toHaveProperty('reasoning_effort')
    expect(fake.chatBodies[0]).not.toHaveProperty('reasoning')
  })

  it('drops the switch for a server that refuses it, and remembers', async () => {
    const fake = fakeSdk({
      chunks: answer,
      chatError: (body) =>
        'reasoning_effort' in body
          ? OpenAiSdk.APIError.generate(
              400,
              { error: { message: 'Unrecognized field: reasoning_effort' } },
              undefined,
              new Headers(),
            )
          : undefined,
    })
    const provider = createOpenAiProvider({
      id: 'compatible',
      baseUrl: 'http://old-server.test/v1',
      loadSdk: fake.loadSdk,
    })
    const events = await collect(provider.chat({ ...ask, thinking: false }))
    expect(events).toContainEqual({ type: 'text', text: 'Hi' })
    expect(fake.chatBodies).toHaveLength(2)
    expect(fake.chatBodies[1]).not.toHaveProperty('reasoning_effort')
    // Not sent to that server and model again.
    await collect(provider.chat({ ...ask, thinking: false }))
    expect(fake.chatBodies).toHaveLength(3)
    expect(fake.chatBodies[2]).not.toHaveProperty('reasoning_effort')
  })

  it('passes on other bad requests as they are', async () => {
    const fake = fakeSdk({
      chatError: () =>
        OpenAiSdk.APIError.generate(
          400,
          { error: { message: 'The prompt is too long' } },
          undefined,
          new Headers(),
        ),
    })
    const provider = createOpenAiProvider({
      id: 'compatible',
      baseUrl: 'http://localhost:11434/v1',
      loadSdk: fake.loadSdk,
    })
    await expect(
      collect(provider.chat({ ...ask, thinking: false })),
    ).rejects.toMatchObject({ kind: 'bad-request' })
    expect(fake.chatBodies).toHaveLength(1)
  })

  it('says when the model is thinking, and keeps it out of the reply', async () => {
    const fake = fakeSdk({
      chunks: [
        // Ollama and OpenRouter send thinking as `reasoning`…
        chunk(null, null, { reasoning: 'The user said hi.' }),
        // …vLLM and LM Studio as `reasoning_content`.
        chunk(null, null, { reasoning_content: 'So I should greet them.' }),
        chunk('Hello!'),
        chunk(null, 'stop'),
      ],
    })
    const provider = createOpenAiProvider({
      id: 'compatible',
      baseUrl: 'http://localhost:11434/v1',
      loadSdk: fake.loadSdk,
    })
    const events = await collect(provider.chat({ ...ask, thinking: true }))
    expect(events).toEqual([
      { type: 'thinking' },
      { type: 'thinking' },
      { type: 'text', text: 'Hello!' },
      { type: 'done', stopReason: 'end' },
    ])
  })

  it('takes a <think> block out of the text, and keeps a reply cut off while thinking empty', async () => {
    const fake = fakeSdk({
      chunks: [
        chunk('<thi'),
        chunk('nk>Hmm, a greeting.</th'),
        chunk('ink>\n\nHel'),
        chunk('lo', 'stop'),
      ],
    })
    const provider = createOpenAiProvider({
      id: 'compatible',
      baseUrl: 'http://localhost:8000/v1',
      loadSdk: fake.loadSdk,
    })
    const events = await collect(provider.chat({ ...ask, thinking: true }))
    expect(
      events
        .filter((event) => event.type === 'text')
        .map((event) => (event as { text: string }).text)
        .join(''),
    ).toBe('Hello')
    // The opening tag is held until it's whole, so two pieces were thinking.
    expect(events.filter((event) => event.type === 'thinking')).toHaveLength(2)

    const cut = fakeSdk({
      chunks: [chunk('<think>Let me think about'), chunk(' this', 'length')],
    })
    const thinkingOnly = createOpenAiProvider({
      id: 'compatible',
      baseUrl: 'http://localhost:8000/v1',
      loadSdk: cut.loadSdk,
    })
    const cutEvents = await collect(thinkingOnly.chat(ask))
    expect(cutEvents.some((event) => event.type === 'text')).toBe(false)
    expect(cutEvents.at(-1)).toEqual({ type: 'done', stopReason: 'max-tokens' })
  })
})
