import { AiError } from './errors'
import { silentWav } from './lib/audio'
import { RequestGate } from './lib/gate'
import {
  streamWithRetry,
  toAiError,
  withRetry,
  type RetryInfo,
  type RetryOptions,
} from './lib/retry'
import { PROVIDERS } from './providers/meta'
import { selection, type AiSettings } from './store'
import type {
  AiProvider,
  AiTask,
  ChatEvent,
  ChatFeature,
  ChatMessage,
  Connection,
  ModelInfo,
  ProviderId,
  StopReason,
  TokenUsage,
} from './types'

export interface AiClientDeps {
  getSettings(): AiSettings
  getKey(provider: ProviderId): Promise<string | undefined>
  createProvider(connection: Connection): AiProvider
  recordUsage(provider: ProviderId, model: string, usage: TokenUsage): void
  /** Overrides, e.g. an instant `sleep` in tests. */
  retry?: Partial<RetryOptions>
  /** Requests allowed at once per provider. */
  maxConcurrent?: number
}

/** Where a reply has got to: the model thinking, or the reply coming in. */
export type ReplyPhase = 'thinking' | 'writing'

export interface ChatOptions {
  messages: ChatMessage[]
  system?: string
  /** The longest reply the feature needs; Settings' cap still applies. */
  maxTokens?: number
  /** What the request is for, so its Thinking switch applies (off without one). */
  feature?: ChatFeature
  signal?: AbortSignal
  /** Called before each retry, e.g. to show "Busy, retrying in 4 s". */
  onRetry?: (info: RetryInfo) => void
  /** Called when the model starts to think, and when its reply starts. */
  onProgress?: (phase: ReplyPhase) => void
}

export interface ChatResult {
  text: string
  stopReason: StopReason
  usage?: TokenUsage
}

export interface ConnectionTest {
  ok: boolean
  provider: ProviderId
  model: string
  latencyMs?: number
  /** Chat: the start of the reply. */
  reply?: string
  /** Embeddings: the vector size. */
  dimensions?: number
  error?: AiError
}

const TASK_NAMES: Record<AiTask, string> = {
  chat: 'a chat',
  embeddings: 'an embeddings',
  transcription: 'a transcription',
}

/** Texts per embeddings request. */
export const EMBED_BATCH = 64
/** Requests per provider at once. */
export const MAX_CONCURRENT = 3

/**
 * Room added to a reply when the model may think first: servers count what
 * it thinks towards the cap, and a short answer shouldn't be squeezed out.
 */
export const THINKING_ROOM = 4096

/**
 * How long a reply may be: what the feature needs (plus room to think),
 * but never more than the cap in Settings, so nothing runs on for ever.
 */
export function replyLength(
  settings: Pick<AiSettings, 'maxReplyTokens'>,
  wanted: number | undefined,
  thinking: boolean,
): number {
  const cap = settings.maxReplyTokens
  if (wanted === undefined) return cap
  return Math.min(cap, wanted + (thinking ? THINKING_ROOM : 0))
}

/**
 * The one entry point features use for AI. It reads the provider, model and
 * key from settings at call time, so features never handle keys, and it
 * applies retries, rate-limit pauses, the concurrency limit and usage
 * counting the same way for every provider.
 */
export function createAiClient(deps: AiClientDeps) {
  const gates = new Map<string, RequestGate>()

  function gateFor(connection: Connection): RequestGate {
    const key = `${connection.provider}|${connection.baseUrl ?? ''}`
    let gate = gates.get(key)
    if (!gate) {
      gate = new RequestGate(deps.maxConcurrent ?? MAX_CONCURRENT)
      gates.set(key, gate)
    }
    return gate
  }

  async function connectionFor(provider: ProviderId): Promise<Connection> {
    const meta = PROVIDERS[provider]
    // Nothing to connect to: the model runs here.
    if (meta.local) return { provider }
    const apiKey = await deps.getKey(provider)
    if (meta.needsKey && !apiKey) {
      throw new AiError(
        'no-key',
        `Add your ${meta.label} API key in Settings → AI.`,
      )
    }
    if (provider !== 'compatible') return { provider, apiKey }
    const baseUrl = deps.getSettings().compatibleBaseUrl.trim()
    if (!baseUrl)
      throw new AiError('no-key', 'Add the server address in Settings → AI.')
    return { provider, apiKey, baseUrl }
  }

  async function target(task: AiTask) {
    const { provider, model } = selection(deps.getSettings(), task)
    const connection = await connectionFor(provider)
    if (!model) {
      throw new AiError(
        'no-model',
        `Choose ${TASK_NAMES[task]} model in Settings → AI.`,
      )
    }
    return {
      connection,
      model,
      provider: deps.createProvider(connection),
      gate: gateFor(connection),
    }
  }

  async function* streamChat(
    options: ChatOptions,
    overrides: Partial<RetryOptions> = {},
  ): AsyncGenerator<ChatEvent> {
    const { connection, model, provider, gate } = await target('chat')
    const settings = deps.getSettings()
    const thinking = options.feature
      ? settings.thinking[options.feature]
      : false
    const maxTokens = replyLength(settings, options.maxTokens, thinking)
    let usage: TokenUsage | undefined
    let phase: ReplyPhase | undefined
    try {
      const events = streamWithRetry(
        () =>
          provider.chat({
            model,
            messages: options.messages,
            system: options.system,
            maxTokens,
            thinking,
            signal: options.signal,
          }),
        {
          ...deps.retry,
          ...overrides,
          gate,
          signal: options.signal,
          onRetry: options.onRetry,
          isOutput: (event) => event.type === 'text',
        },
      )
      for await (const event of events) {
        if (event.type === 'usage') usage = event.usage
        else if (event.type === 'thinking' && !phase) {
          phase = 'thinking'
          options.onProgress?.(phase)
        } else if (event.type === 'text' && phase !== 'writing') {
          phase = 'writing'
          options.onProgress?.(phase)
        }
        yield event
      }
    } finally {
      // Counted even when the reply is cancelled part-way: those tokens were used.
      if (usage) deps.recordUsage(connection.provider, model, usage)
    }
  }

  async function embedWith(
    input: string[],
    options: { signal?: AbortSignal; onRetry?: (info: RetryInfo) => void },
    overrides: Partial<RetryOptions> = {},
  ): Promise<number[][]> {
    if (input.length === 0) return []
    const { connection, model, provider, gate } = await target('embeddings')
    const vectors: number[][] = []
    for (let start = 0; start < input.length; start += EMBED_BATCH) {
      const batch = input.slice(start, start + EMBED_BATCH)
      const result = await withRetry(
        () => provider.embed({ model, input: batch, signal: options.signal }),
        {
          ...deps.retry,
          ...overrides,
          gate,
          signal: options.signal,
          onRetry: options.onRetry,
        },
      )
      // Usage is what providers charge for; the model on this device is free.
      if (!PROVIDERS[connection.provider].local)
        deps.recordUsage(connection.provider, model, result.usage)
      vectors.push(...result.vectors)
    }
    return vectors
  }

  async function transcribeWith(
    audio: Blob,
    options: {
      fileName: string
      language?: string
      signal?: AbortSignal
      onRetry?: (info: RetryInfo) => void
    },
    overrides: Partial<RetryOptions> = {},
  ): Promise<string> {
    const { connection, model, provider, gate } = await target('transcription')
    const result = await withRetry(
      () =>
        provider.transcribe({
          model,
          audio,
          fileName: options.fileName,
          language: options.language,
          signal: options.signal,
        }),
      {
        ...deps.retry,
        ...overrides,
        gate,
        signal: options.signal,
        onRetry: options.onRetry,
      },
    )
    if (result.usage) deps.recordUsage(connection.provider, model, result.usage)
    return result.text
  }

  return {
    /** Streams a reply from the chat model chosen in Settings. Stop reading to cancel. */
    chat: (options: ChatOptions) => streamChat(options),

    /** The whole reply at once. */
    async complete(options: ChatOptions): Promise<ChatResult> {
      let text = ''
      let stopReason: StopReason = 'other'
      let usage: TokenUsage | undefined
      for await (const event of streamChat(options)) {
        if (event.type === 'text') text += event.text
        else if (event.type === 'usage') usage = event.usage
        else if (event.type === 'done') stopReason = event.stopReason
      }
      return { text, stopReason, usage }
    },

    /** Speech as text, from the transcription model chosen in Settings. */
    transcribe: (
      audio: Blob,
      options: {
        /** With the right extension: providers tell the format by it. */
        fileName: string
        language?: string
        signal?: AbortSignal
        onRetry?: (info: RetryInfo) => void
      },
    ) => transcribeWith(audio, options),

    /** One vector per text, from the embeddings model chosen in Settings. */
    embed: (
      input: string[],
      options: {
        signal?: AbortSignal
        onRetry?: (info: RetryInfo) => void
      } = {},
    ) => embedWith(input, options),

    /** The models a provider offers, for choosing one in Settings. */
    async listModels(
      providerId: ProviderId,
      signal?: AbortSignal,
    ): Promise<ModelInfo[]> {
      const connection = await connectionFor(providerId)
      const provider = deps.createProvider(connection)
      return withRetry(() => provider.listModels(signal), {
        ...deps.retry,
        attempts: 1,
        gate: gateFor(connection),
        signal,
      })
    },

    /** Sends one tiny real request with the current settings. Never throws. */
    async testConnection(
      task: AiTask,
      signal?: AbortSignal,
    ): Promise<ConnectionTest> {
      const { provider, model } = selection(deps.getSettings(), task)
      const started = performance.now()
      try {
        if (task === 'chat') {
          let reply = ''
          const events = streamChat(
            {
              system: 'This is a connection test.',
              messages: [
                { role: 'user', content: 'Reply with one word: ready' },
              ],
              maxTokens: 512,
              signal,
            },
            { attempts: 1 },
          )
          for await (const event of events)
            if (event.type === 'text') reply += event.text
          return {
            ok: true,
            provider,
            model,
            latencyMs: Math.round(performance.now() - started),
            reply: reply.trim().slice(0, 80),
          }
        }
        if (task === 'transcription') {
          const heard = await transcribeWith(
            silentWav(),
            { fileName: 'silence.wav', signal },
            { attempts: 1 },
          )
          return {
            ok: true,
            provider,
            model,
            latencyMs: Math.round(performance.now() - started),
            reply: heard.trim().slice(0, 80),
          }
        }
        const [vector] = await embedWith(
          ['Momentum connection test'],
          { signal },
          { attempts: 1 },
        )
        return {
          ok: true,
          provider,
          model,
          latencyMs: Math.round(performance.now() - started),
          dimensions: vector?.length ?? 0,
        }
      } catch (error) {
        return { ok: false, provider, model, error: toAiError(error) }
      }
    },
  }
}

export type AiClient = ReturnType<typeof createAiClient>
