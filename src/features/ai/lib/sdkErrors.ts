import { abortError, AiError, type AiErrorKind } from '../errors'

type ErrorClass = abstract new (...args: never[]) => Error

/**
 * The error classes both official SDKs export (they share a generator, so the
 * shapes match). Passed in because the SDKs are loaded on demand.
 */
export interface SdkErrorClasses {
  APIError: ErrorClass
  APIUserAbortError: ErrorClass
  APIConnectionError: ErrorClass
  APIConnectionTimeoutError: ErrorClass
}

interface ApiErrorShape {
  status?: number
  headers?: Headers
  error?: unknown
  type?: string | null
  message: string
}

/** Error types from response bodies (Anthropic names; OpenAI codes in comments). */
const KIND_BY_TYPE: Record<string, AiErrorKind> = {
  authentication_error: 'auth',
  invalid_api_key: 'auth',
  permission_error: 'permission',
  not_found_error: 'not-found',
  model_not_found: 'not-found',
  invalid_request_error: 'bad-request',
  request_too_large: 'bad-request',
  billing_error: 'quota',
  insufficient_quota: 'quota',
  rate_limit_error: 'rate-limit',
  overloaded_error: 'overloaded',
  api_error: 'server',
  timeout_error: 'timeout',
}

function kindForStatus(status: number): AiErrorKind {
  if (status === 401) return 'auth'
  if (status === 402) return 'quota'
  if (status === 403) return 'permission'
  if (status === 404) return 'not-found'
  if (status === 408) return 'timeout'
  if (status === 409) return 'server'
  if (status === 429) return 'rate-limit'
  if (status === 529) return 'overloaded'
  if (status >= 500) return 'server'
  return 'bad-request'
}

/** The machine-readable error type or code from a response body, if any. */
function bodyType(body: unknown): string | undefined {
  if (typeof body !== 'object' || body === null) return undefined
  const record = body as Record<string, unknown>
  const nested = record.error
  if (typeof nested === 'object' && nested !== null) {
    const inner = nested as Record<string, unknown>
    if (typeof inner.type === 'string') return inner.type
    if (typeof inner.code === 'string') return inner.code
  }
  if (typeof record.code === 'string') return record.code
  if (typeof record.type === 'string' && record.type !== 'error')
    return record.type
  return undefined
}

/** Anthropic's `error.details.error_code`, e.g. `enforced_spend_limit_reached`. */
function bodyErrorCode(body: unknown): string | undefined {
  const details = (
    (body as Record<string, unknown> | undefined)?.error as
      Record<string, unknown> | undefined
  )?.details as Record<string, unknown> | undefined
  return typeof details?.error_code === 'string'
    ? details.error_code
    : undefined
}

/** The provider's own explanation, without the status-code prefix. */
function bodyMessage(error: ApiErrorShape): string {
  const body = error.error as Record<string, unknown> | undefined
  const nested = body?.error as Record<string, unknown> | undefined
  const message = nested?.message ?? body?.message
  return typeof message === 'string' ? message : error.message
}

/** Reads Retry-After (seconds or a date) or retry-after-ms, in milliseconds. */
export function parseRetryAfter(
  headers: Headers | undefined,
  now = Date.now(),
): number | undefined {
  const ms = Number(headers?.get('retry-after-ms') ?? Number.NaN)
  if (Number.isFinite(ms) && ms >= 0) return ms
  const value = headers?.get('retry-after')
  if (!value) return undefined
  const seconds = Number(value)
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000)
  const date = Date.parse(value)
  return Number.isNaN(date) ? undefined : Math.max(0, date - now)
}

/** Turns anything an SDK throws into an `AiError`, with keys redacted. */
export function normalizeSdkError(
  error: unknown,
  sdk: SdkErrorClasses,
  secrets: readonly string[] = [],
): AiError {
  if (error instanceof AiError) return error
  if (error instanceof sdk.APIUserAbortError) return abortError()
  if (error instanceof DOMException && error.name === 'AbortError')
    return abortError()
  const redact = (text: string) =>
    secrets.reduce(
      (result, secret) =>
        secret ? result.split(secret).join('[redacted]') : result,
      text,
    )

  if (error instanceof sdk.APIConnectionTimeoutError) {
    return new AiError('timeout', 'The request timed out.', { cause: error })
  }
  if (error instanceof sdk.APIConnectionError) {
    return new AiError('network', redact(error.message), { cause: error })
  }
  if (error instanceof sdk.APIError) {
    const apiError = error as unknown as ApiErrorShape
    const type = apiError.type ?? bodyType(apiError.error)
    const message = redact(bodyMessage(apiError))
    let kind: AiErrorKind =
      (type && KIND_BY_TYPE[type]) ||
      (apiError.status ? kindForStatus(apiError.status) : 'unknown')
    // Spending caps come back as 429s (Anthropic: no Retry-After) or 400s;
    // retrying can't help until the cap resets or is raised.
    if (
      bodyErrorCode(apiError.error) === 'enforced_spend_limit_reached' ||
      ((kind === 'bad-request' || kind === 'rate-limit') &&
        /credit balance|billing|quota|usage limits?\b/i.test(message))
    ) {
      kind = 'quota'
    }
    return new AiError(kind, message, {
      status: apiError.status,
      retryAfterMs:
        kind === 'quota' ? undefined : parseRetryAfter(apiError.headers),
      cause: error,
    })
  }
  // fetch() failing outright, or the SDK's code chunk failing to load.
  if (error instanceof TypeError) {
    return new AiError('network', redact(error.message), { cause: error })
  }
  const message = error instanceof Error ? error.message : String(error)
  return new AiError('unknown', redact(message), { cause: error })
}
