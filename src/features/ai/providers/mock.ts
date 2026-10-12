import { abortError, type AiError } from '../errors'
import { textOf } from '../lib/content'
import type {
  AiProvider,
  ChatEvent,
  ChatRequest,
  EmbedRequest,
  ModelInfo,
  StopReason,
  TokenUsage,
  TranscribeRequest,
} from '../types'

export interface MockReply {
  /** How many times the model says it's thinking before the text. */
  thinking?: number
  /** Text chunks, streamed in order. */
  chunks?: string[]
  /** Fails instead of replying, or after `failAfter` chunks. */
  error?: AiError
  failAfter?: number
  usage?: TokenUsage
  stopReason?: StopReason
}

export interface MockProviderOptions {
  /** Replies in order (the last one repeats), or a function of the request. */
  replies?: MockReply[] | ((request: ChatRequest, call: number) => MockReply)
  /** Vector for one text. Defaults to a small deterministic hash. */
  embed?: (text: string) => number[]
  embedError?: AiError
  /** What speech becomes; or the error transcribing gives. */
  transcript?: string
  transcribeError?: AiError
  models?: ModelInfo[]
}

export interface MockProvider extends AiProvider {
  readonly calls: ChatRequest[]
  readonly embedCalls: EmbedRequest[]
  readonly transcribeCalls: TranscribeRequest[]
}

function hashVector(text: string, size = 8): number[] {
  const vector = new Array<number>(size).fill(0)
  for (let index = 0; index < text.length; index++) {
    vector[index % size] += text.charCodeAt(index) / 255
  }
  const length = Math.hypot(...vector) || 1
  return vector.map((value) => value / length)
}

/** A provider that answers from a script, for tests and offline development. */
export function createMockProvider(
  options: MockProviderOptions = {},
): MockProvider {
  const calls: ChatRequest[] = []
  const embedCalls: EmbedRequest[] = []
  const transcribeCalls: TranscribeRequest[] = []

  function replyFor(request: ChatRequest, call: number): MockReply {
    const { replies } = options
    if (typeof replies === 'function') return replies(request, call)
    if (replies?.length) return replies[Math.min(call, replies.length - 1)]
    const last = textOf(request.messages.at(-1)?.content ?? '')
    return { chunks: ['Mock reply to: ', last] }
  }

  return {
    id: 'mock',
    calls,
    embedCalls,
    transcribeCalls,

    async *chat(request): AsyncGenerator<ChatEvent> {
      const reply = replyFor(request, calls.length)
      calls.push(request)
      const chunks = reply.chunks ?? []
      const usage = reply.usage ?? {
        inputTokens: request.messages.reduce(
          (sum, message) => sum + textOf(message.content).length,
          0,
        ),
        outputTokens: chunks.join('').length,
      }
      if (reply.error && !reply.failAfter) throw reply.error
      yield {
        type: 'usage',
        usage: { inputTokens: usage.inputTokens, outputTokens: 0 },
      }
      for (let step = 0; step < (reply.thinking ?? 0); step++) {
        await Promise.resolve()
        if (request.signal?.aborted) throw abortError()
        yield { type: 'thinking' }
      }
      for (const [index, text] of chunks.entries()) {
        await Promise.resolve()
        if (request.signal?.aborted) throw abortError()
        if (reply.error && index === reply.failAfter) throw reply.error
        yield { type: 'text', text }
      }
      if (reply.error) throw reply.error
      yield { type: 'usage', usage }
      yield { type: 'done', stopReason: reply.stopReason ?? 'end' }
    },

    async embed(request) {
      embedCalls.push(request)
      if (options.embedError) throw options.embedError
      if (request.signal?.aborted) throw abortError()
      const embed = options.embed ?? ((text: string) => hashVector(text))
      return {
        vectors: request.input.map((text) => embed(text)),
        usage: { inputTokens: request.input.join(' ').length, outputTokens: 0 },
      }
    },

    async transcribe(request) {
      transcribeCalls.push(request)
      if (options.transcribeError) throw options.transcribeError
      if (request.signal?.aborted) throw abortError()
      return { text: options.transcript ?? 'Mock transcript' }
    },

    async listModels() {
      return options.models ?? [{ id: 'mock-model', name: 'Mock model' }]
    },
  }
}
