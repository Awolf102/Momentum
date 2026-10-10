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
  /** How long the provider asked us to wait before trying again. */
  retryAfterMs?: number
  cause?: unknown
}

/** Every failure from the AI layer, sorted into a kind the UI can explain. */
export class AiError extends Error {
  readonly kind: AiErrorKind
  readonly status: number | undefined
  readonly retryAfterMs: number | undefined

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

/** A short, human explanation for an error, for showing in the UI. */
export function describeAiError(error: unknown): string {
  if (!isAiError(error)) return 'Something went wrong. Try again in a moment.'
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
      return 'Your provider account is out of credit or over its spending limit.'
    case 'rate-limit':
      return `The provider's rate limit was reached.${wait}`
    case 'overloaded':
      return `The provider is busy right now.${wait}`
    case 'server':
      return `The provider had a problem.${wait}`
    case 'network':
      return "Couldn't reach the provider. Check your connection, the server address, and (for a local server) that it allows requests from this site."
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
