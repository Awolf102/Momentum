import type { ChatSource } from './types'

export type AiErrorKind =
  /** The provider needs a key and none is saved. */
  | 'no-key'
  /** No model is chosen for this task. */
  | 'no-model'
  /** The provider can't do this (e.g. embeddings from Anthropic). */
  | 'unsupported'
  | 'auth'
  | 'permission'
  /** Unknown model, or the wrong server address. */
  | 'not-found'
  | 'bad-request'
  /** Out of credit. */
  | 'quota'
  | 'rate-limit'
  | 'overloaded'
  | 'server'
  /** Couldn't connect: offline, server down, or blocked by CORS. */
  | 'network'
  /** The browser refused to send it at all (mixed content, a page policy). */
  | 'blocked'
  /** The model on this device ran out of memory, and was unloaded. */
  | 'memory'
  /** The model on this device isn't downloaded yet. */
  | 'unavailable'
  | 'timeout'
  | 'aborted'
  | 'unknown'

const RETRYABLE: ReadonlySet<AiErrorKind> = new Set([
  'rate-limit',
  'overloaded',
  'server',
  'network',
  'timeout',
])

interface AiErrorOptions {
  status?: number
  /** Chat: the provider that failed. */
  source?: ChatSource
  /** Chat: its reply had started, and what came is kept. */
  partial?: boolean
  /** Chat: there's a provider after this one that could be asked. */
  retryNext?: boolean
  /** How long the provider asked us to wait before trying again. */
  retryAfterMs?: number
  /** What to check, in words, when it's known (where the page runs, say). */
  hint?: string
  cause?: unknown
}

/** Every failure from the AI layer, sorted into a kind the UI can explain. */
export class AiError extends Error {
  readonly kind: AiErrorKind
  readonly status: number | undefined
  readonly retryAfterMs: number | undefined
  readonly hint: string | undefined
  readonly source: ChatSource | undefined
  readonly partial: boolean
  readonly retryNext: boolean

  constructor(
    kind: AiErrorKind,
    message: string,
    options: AiErrorOptions = {},
  ) {
    super(redactSecrets(message), { cause: options.cause })
    this.name = 'AiError'
    this.kind = kind
    this.status = options.status
    this.retryAfterMs = options.retryAfterMs
    this.hint = options.hint
    this.source = options.source
    this.partial = options.partial ?? false
    this.retryNext = options.retryNext ?? false
  }

  /** The same failure, with more said about it. */
  with(options: AiErrorOptions): AiError {
    return new AiError(this.kind, this.message, {
      status: this.status,
      retryAfterMs: this.retryAfterMs,
      hint: this.hint,
      source: this.source,
      partial: this.partial,
      retryNext: this.retryNext,
      cause: this.cause,
      ...options,
    })
  }

  get retryable(): boolean {
    return RETRYABLE.has(this.kind)
  }
}

export function isAiError(error: unknown): error is AiError {
  return error instanceof AiError
}

export function abortError(): AiError {
  return new AiError('aborted', 'The request was cancelled.')
}

/**
 * Removes anything that looks like an API key, plus any exact secrets given,
 * so keys never reach an error message, the console or the screen.
 */
export function redactSecrets(
  text: string,
  secrets: readonly string[] = [],
): string {
  let result = text
  for (const secret of secrets) {
    if (secret.length >= 8) result = result.split(secret).join('[redacted]')
  }
  return result
    .replace(/\b(?:sk|gsk|xai|pk|rk)[-_][A-Za-z0-9_-]{8,}/g, '[redacted]')
    .replace(/\b[A-Za-z0-9]{32,}\b/g, '[redacted]')
}

/** Why a reply that had started stopped, in a few words. */
const BROKE_OFF: Partial<Record<AiErrorKind, string>> = {
  network: 'the connection was lost',
  timeout: 'it stopped responding',
  server: 'the server had a problem',
  overloaded: 'the server was too busy',
  memory: 'it ran out of memory',
}

/** A short, human explanation for an error, for showing in the UI. */
export function describeAiError(error: unknown): string {
  if (!isAiError(error)) return 'Something went wrong. Try again in a moment.'
  // Part-way through a reply: what came is kept, and that's what matters.
  if (error.partial) {
    const who = error.source?.name ?? 'The provider'
    const why = BROKE_OFF[error.kind]
    return why
      ? `${who} stopped part-way through (${why}). What came is kept.`
      : `${who} stopped part-way through. What came is kept. ${describeKind(error)}`
  }
  return describeKind(error)
}

function describeKind(error: AiError): string {
  const wait = error.retryAfterMs
    ? ` Try again in ${formatWait(error.retryAfterMs)}.`
    : ' Try again in a moment.'
  switch (error.kind) {
    case 'no-key':
      return 'Add an API key in Settings → AI to use this.'
    case 'no-model':
      return 'Choose a model in Settings → AI to use this.'
    case 'unsupported':
      return error.message
    case 'auth':
      return 'The provider rejected the API key. Check it and save it again.'
    case 'permission':
      return "This key isn't allowed to use that model or feature."
    case 'not-found':
      return "The provider doesn't recognise that model, or the server address is wrong."
    case 'bad-request':
      return `The provider couldn't accept the request: ${error.message}`
    case 'quota':
      return (
        error.hint ??
        'Your provider account is out of credit or over its spending limit.'
      )
    case 'rate-limit':
      return `The provider's rate limit was reached.${wait}`
    case 'overloaded':
      return `The provider is busy right now.${wait}`
    case 'server':
      return `The provider had a problem.${wait}`
    case 'network':
      return error.hint
        ? `Couldn't reach the provider. ${error.hint}`
        : "Couldn't reach the provider. Check your connection, the server address, and (for a local server) that it allows requests from this site."
    case 'blocked':
    case 'memory':
    case 'unavailable':
      return error.message
    case 'timeout':
      return 'The provider took too long to answer.'
    case 'aborted':
      return 'Cancelled.'
    case 'unknown':
      return `Something went wrong: ${error.message}`
  }
}

function formatWait(ms: number): string {
  const seconds = Math.ceil(ms / 1000)
  if (seconds < 90) return `${seconds} s`
  return `${Math.ceil(seconds / 60)} min`
}
