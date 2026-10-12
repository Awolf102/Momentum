import {
  failsOver,
  keyNameOf,
  mayAnswer,
  usageProviderOf,
  type ChatEntry,
} from './chain'
import type { EntryStatus } from './chainStatus'
import { abortError, AiError, describeAiError } from './errors'
import { silentWav } from './lib/audio'
import { RequestGate } from './lib/gate'
import {
  blockedBeforeSending,
  refusedByContentPolicy,
  type Page,
} from './lib/reach'
import {
  streamWithRetry,
  toAiError,
  withRetry,
  type RetryInfo,
  type RetryOptions,
} from './lib/retry'
import { PROVIDERS } from './providers/meta'
import { isOpenRouter, normalizeBaseUrl } from './providers/openai'
import { freeFallbacks, isFreeModel } from './providers/openrouter'
import { entryModel, selection, type AiSettings } from './store'
import type {
  AiProvider,
  AiTask,
  ChatEvent,
  ChatFeature,
  ChatMessage,
  ChatSource,
  Connection,
  ModelInfo,
  ProviderId,
  StopReason,
  TokenUsage,
} from './types'

export interface AiClientDeps {
  getSettings(): AiSettings
  /** A key from `secrets`, by name (a provider's, or one of chat's servers'). */
  getKey(name: string): Promise<string | undefined>
  createProvider(connection: Connection): AiProvider
  /** Counts tokens against a provider: an account, or one of chat's servers. */
  recordUsage(provider: string, model: string, usage: TokenUsage): void
  /** Overrides, e.g. an instant `sleep` in tests. */
  retry?: Partial<RetryOptions>
  /** Requests allowed at once per provider. */
  maxConcurrent?: number
  /** Where this copy of Momentum runs, to tell what the browser will block. */
  page?: () => Page | undefined
  /** Told how chat's providers are doing, as they're checked or asked. */
  onStatus?: (entryId: string, status: EntryStatus) => void
  /** Chat's waits, shorter in tests. */
  timing?: Partial<ChainTiming>
  now?: () => number
}

/** How long chat waits on a provider before going to the next. */
export interface ChainTiming {
  /** A health check (`GET /models`) gives up after this. */
  healthMs: number
  /** And is trusted for this long. */
  healthTtlMs: number
  /** No first word by then: the next provider is asked instead. */
  firstTokenMs: number
  /** The same, when the model may think first. */
  firstTokenThinkingMs: number
}

export const CHAIN_TIMING: ChainTiming = {
  healthMs: 2500,
  healthTtlMs: 60_000,
  firstTokenMs: 20_000,
  firstTokenThinkingMs: 60_000,
}

/** Failures that mean a server isn't there right now, so it's skipped a while. */
const DOWN_KINDS = new Set([
  'network',
  'timeout',
  'server',
  'overloaded',
  'blocked',
])

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
  /** Begin after this one of chat's providers ("Retry with next provider"). */
  after?: string
  /** Only this one of chat's providers (testing it). */
  only?: string
}

export interface ChatResult {
  text: string
  stopReason: StopReason
  usage?: TokenUsage
  /** Which provider and model wrote it. */
  source?: ChatSource
}

export interface ConnectionTest {
  ok: boolean
  provider: ProviderId
  model: string
  latencyMs?: number
  /** Chat: the start of the reply. */
  reply?: string
  /** Chat: how long the first words took (loading the model included). */
  firstTokenMs?: number
  /** Chat on this device: how fast it writes, once it has started. */
  tokensPerSecond?: number
  /** Embeddings: the vector size. */
  dimensions?: number
  /** Chat: which provider and model answered. */
  source?: ChatSource
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

  /** Why the browser will refuse to send to a server, in words, or null. */
  function refusal(page: Page, address: string): string | null {
    if (!blockedBeforeSending(page, address)) return null
    return page.webkit
      ? `Safari won't send anything from this copy of Momentum (open at ${page.origin}) to ${address}: a page served over https can't reach a plain http address, even on this computer. Open Momentum from http://localhost:4173 instead (the README's "On a Mac's Dock" says how), or give the server an https address.`
      : `Browsers won't send anything from a page served over https (this one is open at ${page.origin}) to a plain http address such as ${address}. Give the server an https address, or open Momentum from http://localhost.`
  }

  /**
   * A failure to reach a compatible server, explained: refused by the page's
   * policy, or what to check, with this page's exact origin.
   */
  function explain(error: unknown, connection: Connection): AiError {
    const failure = toAiError(error)
    if (failure.kind !== 'network' || !connection.baseUrl) return failure
    const address = normalizeBaseUrl(connection.baseUrl)
    const page = deps.page?.()
    if (refusedByContentPolicy(address))
      return new AiError(
        'blocked',
        `This page's Content Security Policy (connect-src) doesn't allow ${new URL(address).origin}, so the browser didn't send the request.`,
        { cause: failure },
      )
    if (!page) return failure
    return new AiError(failure.kind, failure.message, {
      status: failure.status,
      cause: failure.cause,
      hint: `Check that the server is running at ${address}, and that it allows requests from ${page.origin}, where this copy of Momentum is open (for Ollama, OLLAMA_ORIGINS=${page.origin}).`,
    })
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
    // Said before sending: the browser would refuse, and the server would
    // never hear of it.
    const page = deps.page?.()
    const refused = page && refusal(page, normalizeBaseUrl(baseUrl))
    if (refused) throw new AiError('blocked', refused)
    return { provider, apiKey, baseUrl }
  }

  const timing = { ...CHAIN_TIMING, ...deps.timing }
  const now = deps.now ?? Date.now

  /** How to reach one of chat's providers, with its own address and key. */
  async function connectionForEntry(entry: ChatEntry): Promise<Connection> {
    const meta = PROVIDERS[entry.provider]
    if (meta.local) return { provider: entry.provider }
    const keyName = keyNameOf(entry)
    const apiKey = keyName ? await deps.getKey(keyName) : undefined
    if (meta.needsKey && !apiKey)
      throw new AiError(
        'no-key',
        `Add ${entry.name}’s API key in Settings → AI.`,
      )
    if (entry.provider !== 'compatible')
      return { provider: entry.provider, apiKey }
    const baseUrl = entry.baseUrl.trim()
    if (!baseUrl)
      throw new AiError(
        'no-key',
        `Add ${entry.name}’s address in Settings → AI.`,
      )
    const page = deps.page?.()
    const refused = page && refusal(page, normalizeBaseUrl(baseUrl))
    if (refused) throw new AiError('blocked', refused)
    return { provider: entry.provider, apiKey, baseUrl }
  }

  interface Health {
    up: boolean
    at: number
    error?: AiError
    models?: ModelInfo[]
  }
  const health = new Map<string, Health>()
  const healthKey = (entry: ChatEntry, connection: Connection) =>
    `${entry.id}|${connection.baseUrl ?? ''}|${connection.apiKey ?? ''}`

  function remember(
    entry: ChatEntry,
    connection: Connection | null,
    result: Omit<Health, 'at'>,
  ) {
    const at = now()
    if (connection) health.set(healthKey(entry, connection), { ...result, at })
    deps.onStatus?.(entry.id, {
      state: result.up ? 'up' : 'down',
      at,
      kind: result.up ? undefined : result.error?.kind,
      message: result.error ? describeAiError(result.error) : undefined,
      models: result.models?.map((model) => model.id),
    })
  }

  /**
   * Whether a network provider is there: a `GET /models`, given 2.5 s and
   * trusted for a minute. Only not being reachable counts as down; a server
   * that answers at all (even "no such page") is up.
   */
  async function checkHealth(
    entry: ChatEntry,
    connection: Connection,
    { signal, fresh = false }: { signal?: AbortSignal; fresh?: boolean } = {},
  ): Promise<Health> {
    const key = healthKey(entry, connection)
    const known = health.get(key)
    if (!fresh && known && now() - known.at < timing.healthTtlMs) return known
    deps.onStatus?.(entry.id, { state: 'checking', at: now() })
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timing.healthMs)
    const stop = () => controller.abort()
    signal?.addEventListener('abort', stop, { once: true })
    try {
      const models = await deps
        .createProvider(connection)
        .listModels(controller.signal)
      remember(entry, connection, { up: true, models })
    } catch (raw) {
      if (signal?.aborted) throw abortError()
      const error = controller.signal.aborted
        ? new AiError(
            'timeout',
            `${entry.name} didn't answer within ${timing.healthMs / 1000} s.`,
          )
        : explain(raw, connection)
      remember(entry, connection, { up: !DOWN_KINDS.has(error.kind), error })
    } finally {
      clearTimeout(timer)
      signal?.removeEventListener('abort', stop)
    }
    return health.get(key)!
  }

  /** OpenRouter's list of models, kept a while (it's long, and changes slowly). */
  const catalogs = new Map<string, { at: number; models: ModelInfo[] }>()
  const CATALOG_TTL_MS = 10 * 60_000

  /**
   * For a free OpenRouter model: two more free ones from its live list, to
   * stand in when the first is busy. None if the list can't be had.
   */
  async function freeStandIns(
    entry: ChatEntry,
    connection: Connection,
    model: string,
    signal?: AbortSignal,
  ): Promise<string[]> {
    if (!isOpenRouter(connection.baseUrl) || !isFreeModel(model)) return []
    const key = healthKey(entry, connection)
    let catalog = catalogs.get(key)
    if (!catalog || now() - catalog.at > CATALOG_TTL_MS) {
      const checked = health.get(key)
      // Not worth holding the reply up for long: without the list, the
      // chosen model is asked alone.
      const listing = new AbortController()
      const stop = () => listing.abort()
      const timer = setTimeout(stop, timing.healthMs * 2)
      signal?.addEventListener('abort', stop, { once: true })
      const models =
        checked?.models ??
        (await deps
          .createProvider(connection)
          .listModels(listing.signal)
          .catch(() => undefined)
          .finally(() => {
            clearTimeout(timer)
            signal?.removeEventListener('abort', stop)
          }))
      if (!models) return []
      catalog = { at: now(), models }
      catalogs.set(key, catalog)
    }
    return freeFallbacks(model, catalog.models)
  }

  /**
   * A provider's stream, given until its first word (or thought) to start:
   * after that, its request is stopped and it counts as timed out.
   */
  async function* firstWithin(
    events: AsyncIterable<ChatEvent>,
    ms: number,
    attempt: AbortController,
    entry: ChatEntry,
  ): AsyncGenerator<ChatEvent> {
    if (!Number.isFinite(ms)) return yield* events
    const iterator = events[Symbol.asyncIterator]()
    let late = false
    const timer = setTimeout(() => {
      late = true
      attempt.abort()
    }, ms)
    try {
      for (;;) {
        let next: IteratorResult<ChatEvent>
        try {
          next = await iterator.next()
        } catch (error) {
          if (late)
            throw new AiError(
              'timeout',
              `${entry.name} didn't start answering within ${ms / 1000} s.`,
            )
          throw error
        }
        if (next.done) return
        if (next.value.type === 'text' || next.value.type === 'thinking')
          clearTimeout(timer)
        yield next.value
      }
    } finally {
      clearTimeout(timer)
      await iterator.return?.()
    }
  }

  /** No provider in the list could answer: each one's reason, together. */
  function noneCouldAnswer(
    failures: ReadonlyArray<{ entry: ChatEntry; error: AiError }>,
    notAllowed: readonly ChatEntry[],
  ): AiError {
    if (failures.length === 1 && notAllowed.length === 0)
      return failures[0].error
    const reasons = failures.map(
      ({ entry, error }) => `${entry.name}: ${describeAiError(error)}`,
    )
    const names = notAllowed.map((entry) => entry.name)
    if (names.length > 0)
      reasons.push(
        `${names.join(' and ')} ${names.length === 1 ? 'isn’t' : 'aren’t'} allowed as a fallback (Settings → AI).`,
      )
    return new AiError(
      'unavailable',
      `None of your chat providers could answer. ${reasons.join(' ')}`,
      { cause: failures.at(-1)?.error },
    )
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

  /**
   * Chat, through its providers in order. Each is tried while the ones
   * above can't answer: a network provider is checked first (and skipped
   * for a minute when it's down), given 20 s to start (60 s if it may
   * think), and passed over on failures that are about it, never on ones
   * that would fail anywhere. A reply that has started is never started
   * again elsewhere: its text is kept and the error says another could be
   * asked (`after`).
   */
  async function* streamChat(
    options: ChatOptions,
    overrides: Partial<RetryOptions> = {},
  ): AsyncGenerator<ChatEvent> {
    const settings = deps.getSettings()
    const thinking = options.feature
      ? settings.thinking[options.feature]
      : false
    const maxTokens = replyLength(settings, options.maxTokens, thinking)
    const { chain } = settings.chat
    const from = options.after
      ? chain.findIndex((entry) => entry.id === options.after) + 1
      : 0
    const listed = chain
      .map((entry, index) => ({ entry, index }))
      .filter(({ entry, index }) =>
        options.only ? entry.id === options.only : index >= from,
      )
    const candidates = options.only
      ? listed
      : listed.filter(({ entry, index }) => mayAnswer(entry, index))
    const notAllowed = listed
      .filter(({ entry, index }) => !options.only && !mayAnswer(entry, index))
      .map(({ entry }) => entry)
    if (candidates.length === 0)
      throw new AiError(
        'unavailable',
        options.after
          ? 'There’s no other chat provider to ask. Add one, or allow one as a fallback, in Settings → AI.'
          : 'Add a chat provider in Settings → AI.',
      )
    const failures: Array<{ entry: ChatEntry; error: AiError }> = []
    let phase: ReplyPhase | undefined

    for (const [position, { entry }] of candidates.entries()) {
      // Whether there's somewhere else to go if this one can't answer.
      const later = position < candidates.length - 1
      const local = PROVIDERS[entry.provider].local
      let connection: Connection
      try {
        connection = await connectionForEntry(entry)
        if (!entryModel(entry))
          throw new AiError(
            'no-model',
            `Choose a model for ${entry.name} in Settings → AI.`,
          )
      } catch (raw) {
        // One that isn't set up is passed over, if others are.
        const error = toAiError(raw)
        if (!later && failures.length === 0) throw error
        failures.push({ entry, error })
        if (!later) break
        continue
      }
      const source: ChatSource = {
        entryId: entry.id,
        name: entry.name,
        provider: entry.provider,
        model: entryModel(entry),
      }
      if (later && !local) {
        const checked = await checkHealth(entry, connection, {
          signal: options.signal,
        })
        if (!checked.up) {
          failures.push({ entry, error: checked.error! })
          continue
        }
      }
      const provider = deps.createProvider(connection)
      const fallbackModels = await freeStandIns(
        entry,
        connection,
        source.model,
        options.signal,
      )
      // Loading the model on this device can take a while; it fails fast
      // when it can't answer, so it isn't timed.
      const wait =
        later && !local
          ? thinking
            ? timing.firstTokenThinkingMs
            : timing.firstTokenMs
          : Number.POSITIVE_INFINITY
      let usage: TokenUsage | undefined
      let announced = false
      let shown = false
      try {
        const events = streamWithRetry(
          () => {
            const attempt = new AbortController()
            options.signal?.addEventListener('abort', () => attempt.abort(), {
              once: true,
            })
            return firstWithin(
              provider.chat({
                model: source.model,
                messages: options.messages,
                system: options.system,
                maxTokens,
                thinking,
                ...(fallbackModels.length > 0 ? { fallbackModels } : {}),
                signal: attempt.signal,
              }),
              wait,
              attempt,
              entry,
            )
          },
          {
            ...deps.retry,
            ...overrides,
            gate: gateFor(connection),
            signal: options.signal,
            onRetry: options.onRetry,
            isOutput: (event) => event.type === 'text',
            // With another to ask, only rate limits are waited out here.
            ...(later
              ? { retryable: (error: AiError) => error.kind === 'rate-limit' }
              : {}),
          },
        )
        for await (const event of events) {
          if (event.type === 'model') {
            if (event.model !== source.model) {
              source.model = event.model
              if (announced) yield { type: 'source', source: { ...source } }
            }
            continue
          }
          if (!announced && event.type !== 'usage') {
            announced = true
            yield { type: 'source', source: { ...source } }
          }
          if (event.type === 'usage') usage = event.usage
          else if (event.type === 'thinking' && !phase) {
            phase = 'thinking'
            options.onProgress?.(phase)
          } else if (event.type === 'text') {
            shown = true
            if (phase !== 'writing') {
              phase = 'writing'
              options.onProgress?.(phase)
            }
          }
          yield event
        }
        remember(entry, local ? null : connection, { up: true })
        return
      } catch (raw) {
        const error = explain(raw, connection)
        if (error.kind === 'aborted' || options.signal?.aborted)
          throw (error.kind === 'aborted' ? error : abortError()).with({
            source,
          })
        const passOn = failsOver(error)
        if (passOn)
          remember(entry, local ? null : connection, { up: false, error })
        // Started: never begun again elsewhere without asking.
        if (shown) throw error.with({ source, partial: true, retryNext: later })
        if (!passOn) throw error.with({ source })
        failures.push({ entry, error: error.with({ source }) })
      } finally {
        // Counted even when the reply is cancelled part-way: those tokens
        // were used. The model on this device costs nothing, so it isn't.
        if (usage && !local)
          deps.recordUsage(usageProviderOf(entry), source.model, usage)
      }
    }
    throw noneCouldAnswer(failures, notAllowed)
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
      ).catch((error: unknown) => {
        throw explain(error, connection)
      })
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
    ).catch((error: unknown) => {
      throw explain(error, connection)
    })
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
      let source: ChatSource | undefined
      for await (const event of streamChat(options)) {
        if (event.type === 'text') text += event.text
        else if (event.type === 'usage') usage = event.usage
        else if (event.type === 'done') stopReason = event.stopReason
        else if (event.type === 'source') source = event.source
      }
      return { text, stopReason, usage, source }
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
      }).catch((error: unknown) => {
        throw explain(error, connection)
      })
    },

    /** The models one of chat's providers offers, from its own `/models`. */
    async listEntryModels(
      entry: ChatEntry,
      signal?: AbortSignal,
    ): Promise<ModelInfo[]> {
      const connection = await connectionForEntry(entry)
      const provider = deps.createProvider(connection)
      return withRetry(() => provider.listModels(signal), {
        ...deps.retry,
        attempts: 1,
        gate: gateFor(connection),
        signal,
      }).catch((error: unknown) => {
        throw explain(error, connection)
      })
    },

    /**
     * Checks every network provider in chat's list now (Settings' "Check
     * now", and on opening it), each told through `onStatus`.
     */
    async checkChain({
      fresh = false,
      signal,
    }: { fresh?: boolean; signal?: AbortSignal } = {}): Promise<void> {
      await Promise.all(
        deps.getSettings().chat.chain.map(async (entry) => {
          if (PROVIDERS[entry.provider].local) return
          let connection: Connection
          try {
            connection = await connectionForEntry(entry)
          } catch {
            // Not set up yet: nothing to check.
            return
          }
          await checkHealth(entry, connection, { signal, fresh }).catch(
            () => undefined,
          )
        }),
      )
    },

    /**
     * Sends one tiny real request with the current settings (for chat, to
     * one provider in its list, or wherever it would go). Never throws.
     */
    async testConnection(
      task: AiTask,
      signal?: AbortSignal,
      { entryId }: { entryId?: string } = {},
    ): Promise<ConnectionTest> {
      const settings = deps.getSettings()
      const tested =
        task === 'chat' && entryId
          ? settings.chat.chain.find((entry) => entry.id === entryId)
          : undefined
      const { provider, model } = tested
        ? { provider: tested.provider, model: entryModel(tested) }
        : selection(settings, task)
      const started = performance.now()
      try {
        if (task === 'chat') {
          // On this device nothing is sent or paid for, so the test writes a
          // little more: enough to tell how fast it goes.
          const local = PROVIDERS[provider].local
          let reply = ''
          let first: number | undefined
          let outputTokens = 0
          let source: ChatSource | undefined
          const events = streamChat(
            {
              ...(tested ? { only: tested.id } : {}),
              system: 'This is a connection test.',
              messages: [
                {
                  role: 'user',
                  content: local
                    ? 'Count from 1 to 20, with spaces between the numbers.'
                    : 'Reply with one word: ready',
                },
              ],
              maxTokens: local ? 128 : 512,
              signal,
            },
            { attempts: 1 },
          )
          for await (const event of events) {
            if (event.type === 'text') {
              first ??= performance.now()
              reply += event.text
            } else if (event.type === 'usage')
              outputTokens = event.usage.outputTokens
            else if (event.type === 'source') source = event.source
          }
          const ended = performance.now()
          const writing = first === undefined ? 0 : (ended - first) / 1000
          return {
            ok: true,
            provider: source?.provider ?? provider,
            model: source?.model ?? model,
            source,
            latencyMs: Math.round(ended - started),
            reply: reply.trim().slice(0, 80),
            firstTokenMs:
              first === undefined ? undefined : Math.round(first - started),
            tokensPerSecond:
              local && writing > 0 && outputTokens > 1
                ? Math.round(((outputTokens - 1) / writing) * 10) / 10
                : undefined,
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
        const failure = toAiError(error)
        return {
          ok: false,
          provider,
          model,
          source: failure.source,
          error: failure,
        }
      }
    },
  }
}

export type AiClient = ReturnType<typeof createAiClient>
