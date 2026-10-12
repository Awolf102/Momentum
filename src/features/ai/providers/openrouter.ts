/**
 * OpenRouter's free models: each request names a few, so a busy one is
 * stood in for by another, and its two rate limits (per minute, per day)
 * are told apart. Pure.
 */
import { AiError } from '../errors'
import type { ModelInfo } from '../types'

/** How many models a request names in all, the chosen one included. */
export const FREE_MODELS_PER_REQUEST = 3

export function isFreeModel(model: string): boolean {
  return model.endsWith(':free')
}

/**
 * Free models to fall back on, from OpenRouter's live list: ones from the
 * same maker first (closest in how they answer), then any others, up to
 * two. None for a model that isn't free: a paid one is chosen on purpose.
 */
export function freeFallbacks(
  model: string,
  catalog: readonly ModelInfo[],
): string[] {
  if (!isFreeModel(model)) return []
  const maker = model.split('/')[0]
  const others = catalog
    .map((info) => info.id)
    .filter(
      (id) => isFreeModel(id) && id !== model && !id.startsWith('openrouter/'),
    )
  const same = others.filter((id) => id.split('/')[0] === maker)
  const rest = others.filter((id) => id.split('/')[0] !== maker)
  return [...same, ...rest].slice(0, FREE_MODELS_PER_REQUEST - 1)
}

/** A header from the response, or from the copy OpenRouter puts in its body. */
function limitHeader(
  name: string,
  headers: Headers | undefined,
  body: unknown,
): string | undefined {
  const direct = headers?.get(name)
  if (direct) return direct
  const meta = (
    (body as { error?: { metadata?: { headers?: Record<string, unknown> } } })
      ?.error ?? (body as { metadata?: { headers?: Record<string, unknown> } })
  )?.metadata?.headers
  const value = meta?.[name] ?? meta?.[name.toLowerCase()]
  return typeof value === 'string' || typeof value === 'number'
    ? String(value)
    : undefined
}

/**
 * OpenRouter's rate limits, read: the daily free allowance (nothing to do
 * but wait for tomorrow, so it isn't retried) or the per-minute one (worth
 * waiting out, until the reset it gives).
 */
export function openRouterLimit(
  error: AiError,
  response: { headers?: Headers; body?: unknown },
  now = Date.now(),
): AiError {
  if (error.kind !== 'rate-limit' && error.kind !== 'quota') return error
  if (error.status !== 429) return error
  if (/per[- ]day|daily/i.test(error.message))
    return new AiError('quota', error.message, {
      status: 429,
      hint: 'Daily free limit reached, resets tomorrow.',
      cause: error.cause ?? error,
    })
  if (error.retryAfterMs !== undefined) return error
  const reset = Number(
    limitHeader('X-RateLimit-Reset', response.headers, response.body),
  )
  if (!Number.isFinite(reset) || reset <= 0) return error
  // Milliseconds since 1970 (OpenRouter's), or seconds.
  const at = reset > 1e12 ? reset : reset * 1000
  return error.with({ retryAfterMs: Math.max(1000, at - now) })
}
