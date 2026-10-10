/**
 * The adapters with the real SDKs, against a local stand-in for the
 * provider APIs: checks streaming, errors and request shapes end to end
 * without a network or a key.
 */
import {
  createServer,
  type IncomingMessage,
  type Server,
  type ServerResponse,
} from 'node:http'
import type { AddressInfo } from 'node:net'
import * as AnthropicSdk from '@anthropic-ai/sdk'
import * as OpenAiSdk from 'openai'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import type { ChatEvent } from '../types'
import { createAnthropicProvider } from './anthropic'
import { createOpenAiProvider } from './openai'

interface Recorded {
  method: string
  path: string
  headers: IncomingMessage['headers']
  body: Record<string, unknown> | null
}

let server: Server
let base = ''
let recorded: Recorded[] = []
let behaviour: 'ok' | 'rate-limited' | 'overloaded-mid-stream' = 'ok'

function sse(
  response: ServerResponse,
  events: Array<[string | null, object | string]>,
) {
  response.writeHead(200, { 'content-type': 'text/event-stream' })
  for (const [event, data] of events) {
    if (event) response.write(`event: ${event}\n`)
    response.write(
      `data: ${typeof data === 'string' ? data : JSON.stringify(data)}\n\n`,
    )
  }
  response.end()
}

function json(
  response: ServerResponse,
  status: number,
  body: object,
  headers: Record<string, string> = {},
) {
  response.writeHead(status, { 'content-type': 'application/json', ...headers })
  response.end(JSON.stringify(body))
}

function handle(
  request: IncomingMessage,
  response: ServerResponse,
  body: Record<string, unknown> | null,
) {
  const path = request.url ?? ''
  if (behaviour === 'rate-limited') {
    return json(
      response,
      429,
      {
        type: 'error',
        error: { type: 'rate_limit_error', message: 'Slow down' },
      },
      { 'retry-after': '7' },
    )
  }
  // Anthropic
  if (path.startsWith('/v1/models/')) {
    return json(response, 200, {
      type: 'model',
      id: 'claude-local',
      display_name: 'Claude Local',
      created_at: '2026-01-01T00:00:00Z',
      max_tokens: 2048,
    })
  }
  if (path === '/v1/messages') {
    const events: Array<[string, object]> = [
      [
        'message_start',
        {
          type: 'message_start',
          message: {
            id: 'msg_local',
            type: 'message',
            role: 'assistant',
            model: 'claude-local',
            content: [],
            stop_reason: null,
            stop_sequence: null,
            usage: {
              input_tokens: 11,
              output_tokens: 1,
              cache_creation_input_tokens: 0,
              cache_read_input_tokens: 0,
            },
          },
        },
      ],
      [
        'content_block_start',
        {
          type: 'content_block_start',
          index: 0,
          content_block: { type: 'text', text: '' },
        },
      ],
      [
        'content_block_delta',
        {
          type: 'content_block_delta',
          index: 0,
          delta: { type: 'text_delta', text: 'Hello' },
        },
      ],
    ]
    if (behaviour === 'overloaded-mid-stream') {
      return sse(response, [
        ...events,
        [
          'error',
          {
            type: 'error',
            error: { type: 'overloaded_error', message: 'Overloaded' },
          },
        ],
      ])
    }
    return sse(response, [
      ...events,
      [
        'content_block_delta',
        {
          type: 'content_block_delta',
          index: 0,
          delta: { type: 'text_delta', text: ' world' },
        },
      ],
      ['content_block_stop', { type: 'content_block_stop', index: 0 }],
      [
        'message_delta',
        {
          type: 'message_delta',
          delta: { stop_reason: 'end_turn', stop_sequence: null },
          usage: { output_tokens: 5 },
        },
      ],
      ['message_stop', { type: 'message_stop' }],
    ])
  }
  // OpenAI-compatible
  if (path === '/v1/chat/completions') {
    const chunk = (delta: object, finish: string | null = null) => ({
      id: 'chatcmpl-local',
      object: 'chat.completion.chunk',
      created: 0,
      model: 'llama-local',
      choices: [{ index: 0, delta, finish_reason: finish }],
    })
    return sse(response, [
      [null, chunk({ role: 'assistant', content: '' })],
      [null, chunk({ content: 'Ready' })],
      [null, chunk({}, 'stop')],
      [
        null,
        {
          id: 'chatcmpl-local',
          object: 'chat.completion.chunk',
          created: 0,
          model: 'llama-local',
          choices: [],
          usage: { prompt_tokens: 9, completion_tokens: 1, total_tokens: 10 },
        },
      ],
      [null, '[DONE]'],
    ])
  }
  if (path === '/v1/embeddings') {
    const input = (body?.input as string[]) ?? []
    return json(response, 200, {
      object: 'list',
      data: input.map((_, index) => ({
        object: 'embedding',
        index,
        embedding: [index, 0.5, 0.25],
      })),
      model: 'embed-local',
      usage: { prompt_tokens: 4, total_tokens: 4 },
    })
  }
  if (path === '/v1/models') {
    return json(response, 200, {
      object: 'list',
      data: [
        { id: 'llama-local', object: 'model', created: 0, owned_by: 'local' },
        { id: 'embed-local', object: 'model', created: 0, owned_by: 'local' },
      ],
    })
  }
  json(response, 404, { error: { message: 'Not found' } })
}

beforeAll(async () => {
  server = createServer((request, response) => {
    let text = ''
    request.on('data', (chunk) => (text += chunk))
    request.on('end', () => {
      const body = text ? (JSON.parse(text) as Record<string, unknown>) : null
      recorded.push({
        method: request.method ?? '',
        path: request.url ?? '',
        headers: request.headers,
        body,
      })
      handle(request, response, body)
    })
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
})

afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())))

beforeEach(() => {
  recorded = []
  behaviour = 'ok'
})

/** The real Anthropic SDK, pointed at the local server. */
function localAnthropic(): typeof AnthropicSdk {
  class Local extends AnthropicSdk.default {
    constructor(
      options: ConstructorParameters<typeof AnthropicSdk.default>[0],
    ) {
      super({ ...options, baseURL: base })
    }
  }
  return { ...AnthropicSdk, default: Local } as typeof AnthropicSdk
}

async function collect(stream: AsyncIterable<ChatEvent>): Promise<ChatEvent[]> {
  const events: ChatEvent[] = []
  for await (const event of stream) events.push(event)
  return events
}

describe('Anthropic adapter with the real SDK', () => {
  const provider = () =>
    createAnthropicProvider({
      apiKey: 'sk-ant-local-test',
      loadSdk: async () => localAnthropic(),
    })

  it('streams a reply, capped at the model limit, with browser access enabled', async () => {
    const events = await collect(
      provider().chat({
        model: 'claude-local',
        system: 'Be brief.',
        messages: [{ role: 'user', content: 'Hi' }],
      }),
    )
    expect(
      events
        .filter((event) => event.type === 'text')
        .map((event) => event.text),
    ).toEqual(['Hello', ' world'])
    expect(events.at(-2)).toEqual({
      type: 'usage',
      usage: { inputTokens: 11, outputTokens: 5 },
    })
    expect(events.at(-1)).toEqual({ type: 'done', stopReason: 'end' })

    const message = recorded.find((request) => request.path === '/v1/messages')!
    expect(message.body).toMatchObject({
      model: 'claude-local',
      max_tokens: 2048,
      stream: true,
      system: 'Be brief.',
    })
    expect(message.headers['x-api-key']).toBe('sk-ant-local-test')
    expect(message.headers['anthropic-dangerous-direct-browser-access']).toBe(
      'true',
    )
  })

  it('reports a rate limit with its wait, without retrying inside the SDK', async () => {
    behaviour = 'rate-limited'
    await expect(
      collect(
        provider().chat({
          model: 'claude-rate-limited',
          messages: [{ role: 'user', content: 'Hi' }],
        }),
      ),
    ).rejects.toMatchObject({ kind: 'rate-limit', retryAfterMs: 7000 })
    // One models lookup and one message request: no hidden SDK retries.
    expect(
      recorded.filter((request) => request.path === '/v1/messages'),
    ).toHaveLength(1)
  })

  it('recognises an error event in the middle of a stream', async () => {
    behaviour = 'overloaded-mid-stream'
    const seen: ChatEvent[] = []
    await expect(
      (async () => {
        for await (const event of provider().chat({
          model: 'claude-overloaded',
          messages: [{ role: 'user', content: 'Hi' }],
        }))
          seen.push(event)
      })(),
    ).rejects.toMatchObject({ kind: 'overloaded' })
    expect(seen).toContainEqual({ type: 'text', text: 'Hello' })
  })
})

describe('OpenAI-compatible adapter with the real SDK', () => {
  const provider = () =>
    createOpenAiProvider({
      id: 'compatible',
      baseUrl: base,
      loadSdk: async () => OpenAiSdk,
    })

  it('streams a reply with usage from a compatible server', async () => {
    const events = await collect(
      provider().chat({
        model: 'llama-local',
        messages: [{ role: 'user', content: 'Hi' }],
        maxTokens: 64,
      }),
    )
    expect(events).toEqual([
      { type: 'text', text: 'Ready' },
      { type: 'usage', usage: { inputTokens: 9, outputTokens: 1 } },
      { type: 'done', stopReason: 'end' },
    ])
    const request = recorded.find(
      (entry) => entry.path === '/v1/chat/completions',
    )!
    expect(request.body).toMatchObject({
      stream: true,
      stream_options: { include_usage: true },
      max_tokens: 64,
    })
  })

  it('embeds and lists models', async () => {
    const result = await provider().embed({
      model: 'embed-local',
      input: ['a', 'b'],
    })
    expect(result.vectors).toEqual([
      [0, 0.5, 0.25],
      [1, 0.5, 0.25],
    ])
    expect((await provider().listModels()).map((model) => model.id)).toEqual([
      'embed-local',
      'llama-local',
    ])
  })
})
