import * as AnthropicSdk from '@anthropic-ai/sdk'
import * as OpenAiSdk from 'openai'
import { describe, expect, it } from 'vitest'
import { describeAiError, redactSecrets } from '../errors'
import { normalizeSdkError, parseRetryAfter } from './sdkErrors'

const KEY = 'sk-ant-api03-abcdefghijklmnopqrstuvwxyz0123456789'

function anthropicError(
  status: number | undefined,
  body: object,
  headers: Record<string, string> = {},
) {
  return AnthropicSdk.APIError.generate(
    status,
    body,
    undefined,
    new Headers(headers),
  )
}

describe('normalizeSdkError (Anthropic)', () => {
  it('reads rate limits and how long to wait', () => {
    const error = normalizeSdkError(
      anthropicError(
        429,
        {
          type: 'error',
          error: { type: 'rate_limit_error', message: 'Slow down' },
        },
        { 'retry-after': '3' },
      ),
      AnthropicSdk,
    )
    expect(error).toMatchObject({
      kind: 'rate-limit',
      status: 429,
      retryAfterMs: 3000,
      retryable: true,
    })
    expect(error.message).toBe('Slow down')
  })

  it('sorts common failures', () => {
    const kind = (status: number, type: string) =>
      normalizeSdkError(
        anthropicError(status, {
          type: 'error',
          error: { type, message: 'x' },
        }),
        AnthropicSdk,
      ).kind
    expect(kind(401, 'authentication_error')).toBe('auth')
    expect(kind(403, 'permission_error')).toBe('permission')
    expect(kind(404, 'not_found_error')).toBe('not-found')
    expect(kind(400, 'invalid_request_error')).toBe('bad-request')
    expect(kind(529, 'overloaded_error')).toBe('overloaded')
    expect(kind(500, 'api_error')).toBe('server')
  })

  it('recognises errors that arrive mid-stream, without a status', () => {
    // How the SDK's stream reader throws an SSE `error` event.
    const body = {
      type: 'error',
      error: { type: 'overloaded_error', message: 'Overloaded' },
    }
    const error = normalizeSdkError(
      new AnthropicSdk.APIError(
        undefined,
        body,
        undefined,
        new Headers(),
        'overloaded_error',
      ),
      AnthropicSdk,
    )
    expect(error).toMatchObject({
      kind: 'overloaded',
      retryable: true,
      message: 'Overloaded',
    })
  })

  it("doesn't retry a reached spending cap", () => {
    const error = normalizeSdkError(
      anthropicError(429, {
        type: 'error',
        error: {
          type: 'rate_limit_error',
          message: 'You have reached your API usage limits.',
          details: { error_code: 'enforced_spend_limit_reached' },
        },
      }),
      AnthropicSdk,
    )
    expect(error).toMatchObject({ kind: 'quota', retryable: false })
  })

  it('treats a user-set spend limit as out of credit', () => {
    const error = normalizeSdkError(
      anthropicError(400, {
        type: 'error',
        error: {
          type: 'invalid_request_error',
          message: 'You have reached your specified API usage limits.',
        },
      }),
      AnthropicSdk,
    )
    expect(error.kind).toBe('quota')
  })

  it('maps connection problems and cancellation', () => {
    expect(
      normalizeSdkError(
        new AnthropicSdk.APIConnectionError({ message: 'Connection error.' }),
        AnthropicSdk,
      ).kind,
    ).toBe('network')
    expect(
      normalizeSdkError(
        new AnthropicSdk.APIConnectionTimeoutError(),
        AnthropicSdk,
      ).kind,
    ).toBe('timeout')
    expect(
      normalizeSdkError(new AnthropicSdk.APIUserAbortError(), AnthropicSdk)
        .kind,
    ).toBe('aborted')
    expect(
      normalizeSdkError(new TypeError('Failed to fetch'), AnthropicSdk).kind,
    ).toBe('network')
  })

  it('never lets the key into the message', () => {
    const error = normalizeSdkError(
      anthropicError(401, {
        type: 'error',
        error: {
          type: 'authentication_error',
          message: `invalid x-api-key ${KEY}`,
        },
      }),
      AnthropicSdk,
      [KEY],
    )
    expect(error.message).not.toContain(KEY)
    expect(error.message).toContain('[redacted]')
    expect(describeAiError(error)).not.toContain(KEY)
  })
})

describe('normalizeSdkError (OpenAI)', () => {
  it('treats insufficient_quota as out of credit, not a rate limit', () => {
    const error = normalizeSdkError(
      OpenAiSdk.APIError.generate(
        429,
        {
          error: {
            message: 'You exceeded your current quota',
            type: 'insufficient_quota',
            code: 'insufficient_quota',
          },
        },
        undefined,
        new Headers(),
      ),
      OpenAiSdk,
    )
    expect(error).toMatchObject({ kind: 'quota', retryable: false })
  })

  it('reads retry-after-ms', () => {
    const error = normalizeSdkError(
      OpenAiSdk.APIError.generate(
        429,
        {
          error: {
            message: 'Rate limit reached',
            type: 'requests',
            code: 'rate_limit_exceeded',
          },
        },
        undefined,
        new Headers({ 'retry-after-ms': '1500' }),
      ),
      OpenAiSdk,
    )
    expect(error).toMatchObject({ kind: 'rate-limit', retryAfterMs: 1500 })
  })
})

describe('parseRetryAfter', () => {
  it('accepts seconds, milliseconds and dates', () => {
    expect(parseRetryAfter(new Headers({ 'retry-after': '2' }))).toBe(2000)
    expect(parseRetryAfter(new Headers({ 'retry-after-ms': '250' }))).toBe(250)
    const now = Date.parse('2026-10-10T00:00:00Z')
    expect(
      parseRetryAfter(
        new Headers({ 'retry-after': 'Sat, 10 Oct 2026 00:00:30 GMT' }),
        now,
      ),
    ).toBe(30_000)
    expect(parseRetryAfter(new Headers())).toBeUndefined()
  })
})

describe('redactSecrets', () => {
  it('hides key-shaped text but keeps model names readable', () => {
    expect(redactSecrets('key sk-proj-AbC123dEf456GhI789 rejected')).toBe(
      'key [redacted] rejected',
    )
    expect(redactSecrets('model claude-opus-5-5 not found')).toBe(
      'model claude-opus-5-5 not found',
    )
    expect(
      redactSecrets('token abcdefghijklmnopqrstuvwxyz0123456789ABCD'),
    ).toBe('token [redacted]')
  })
})
