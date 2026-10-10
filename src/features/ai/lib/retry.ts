import { abortError, AiError, isAiError } from '../errors'
import type { RequestGate } from './gate'

export interface RetryInfo {
  /** The attempt that just failed (1 = the first try). */
  attempt: number
  delayMs: number
  error: AiError
}

export interface RetryOptions {
  /** Total tries, including the first. */
  attempts: number
  baseDelayMs: number
  maxDelayMs: number
  /** The longest wait a provider may ask for before we give up instead. */
  maxRetryAfterMs: number
  signal?: AbortSignal
  onRetry?: (info: RetryInfo) => void
  /** Shared per provider: limits concurrency and spreads rate-limit pauses. */
  gate?: RequestGate
  sleep: (ms: number, signal?: AbortSignal) => Promise<void>
  random: () => number
}

export const DEFAULT_RETRY: RetryOptions = {
  attempts: 4,
  baseDelayMs: 1000,
  maxDelayMs: 20_000,
  maxRetryAfterMs: 60_000,
  sleep,
  random: Math.random,
}

export function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(abortError())
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort)
      resolve()
    }, ms)
    function onAbort() {
      clearTimeout(timer)
      reject(abortError())
    }
    signal?.addEventListener('abort', onAbort, { once: true })
  })
}

export function toAiError(error: unknown): AiError {
  if (isAiError(error)) return error
  if (error instanceof DOMException && error.name === 'AbortError')
    return abortError()
  const message = error instanceof Error ? error.message : String(error)
  return new AiError('unknown', message, { cause: error })
}

/**
 * How long to wait before another try, or `null` to give up. Honours the
 * provider's Retry-After when it sent one; otherwise backs off exponentially
 * with jitter.
 */
export function retryDelay(
  error: AiError,
  attempt: number,
  options: Pick<
    RetryOptions,
    'attempts' | 'baseDelayMs' | 'maxDelayMs' | 'maxRetryAfterMs' | 'random'
  >,
): number | null {
  if (!error.retryable || attempt >= options.attempts) return null
  if (error.retryAfterMs !== undefined) {
    return error.retryAfterMs <= options.maxRetryAfterMs
      ? error.retryAfterMs
      : null
  }
  const ceiling = Math.min(
    options.maxDelayMs,
    options.baseDelayMs * 2 ** (attempt - 1),
  )
  return Math.round(ceiling / 2 + (options.random() * ceiling) / 2)
}

async function backOff(
  error: AiError,
  attempt: number,
  options: RetryOptions,
): Promise<void> {
  const delay = retryDelay(error, attempt, options)
  if (delay === null) throw error
  if (error.kind === 'rate-limit' || error.kind === 'overloaded')
    options.gate?.coolDown(delay)
  options.onRetry?.({ attempt, delayMs: delay, error })
  await options.sleep(delay, options.signal)
}

/** Runs a request, retrying failures that are worth retrying. */
export async function withRetry<T>(
  run: () => Promise<T>,
  overrides: Partial<RetryOptions> = {},
): Promise<T> {
  const options = { ...DEFAULT_RETRY, ...overrides }
  for (let attempt = 1; ; attempt++) {
    if (options.signal?.aborted) throw abortError()
    const release = await (options.gate?.acquire(options.signal) ?? noop)
    let failure: AiError
    try {
      return await run()
    } catch (raw) {
      failure = toAiError(raw)
    } finally {
      release()
    }
    await backOff(failure, attempt, options)
  }
}

/**
 * Streams a request with retries, but only until the first real output
 * arrives: after that a failure is passed on, so text is never repeated.
 */
export async function* streamWithRetry<T>(
  open: () => AsyncIterable<T>,
  overrides: Partial<RetryOptions> & { isOutput?: (event: T) => boolean } = {},
): AsyncGenerator<T> {
  const options = { ...DEFAULT_RETRY, ...overrides }
  const isOutput = overrides.isOutput ?? (() => true)
  for (let attempt = 1; ; attempt++) {
    if (options.signal?.aborted) throw abortError()
    const release = await (options.gate?.acquire(options.signal) ?? noop)
    let started = false
    let failure: AiError
    try {
      for await (const event of open()) {
        if (isOutput(event)) started = true
        yield event
      }
      return
    } catch (raw) {
      failure = toAiError(raw)
      if (started) throw failure
    } finally {
      release()
    }
    await backOff(failure, attempt, options)
  }
}

const noop = Promise.resolve(() => {})
