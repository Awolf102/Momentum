import { describe, expect, it, vi } from 'vitest'
import { AiError } from '../errors'
import { RequestGate } from './gate'
import {
  DEFAULT_RETRY,
  retryDelay,
  streamWithRetry,
  withRetry,
  type RetryOptions,
} from './retry'

const instant = (delays: number[] = []): Partial<RetryOptions> => ({
  sleep: async (ms) => void delays.push(ms),
  random: () => 0.5,
})

describe('retryDelay', () => {
  const options = { ...DEFAULT_RETRY, random: () => 1 }

  it('backs off exponentially, up to a ceiling', () => {
    const error = new AiError('overloaded', 'busy')
    expect(retryDelay(error, 1, options)).toBe(1000)
    expect(retryDelay(error, 2, options)).toBe(2000)
    expect(retryDelay(error, 3, options)).toBe(4000)
    expect(retryDelay(error, 3, { ...options, maxDelayMs: 3000 })).toBe(3000)
  })

  it('adds jitter in the upper half of the window', () => {
    const error = new AiError('server', 'oops')
    expect(retryDelay(error, 2, { ...options, random: () => 0 })).toBe(1000)
  })

  it("honours the provider's Retry-After, unless it's too long", () => {
    expect(
      retryDelay(
        new AiError('rate-limit', 'slow down', { retryAfterMs: 7000 }),
        1,
        options,
      ),
    ).toBe(7000)
    expect(
      retryDelay(
        new AiError('rate-limit', 'slow down', { retryAfterMs: 120_000 }),
        1,
        options,
      ),
    ).toBeNull()
  })

  it("doesn't retry errors that won't change, or after the last attempt", () => {
    expect(retryDelay(new AiError('auth', 'bad key'), 1, options)).toBeNull()
    expect(retryDelay(new AiError('quota', 'no credit'), 1, options)).toBeNull()
    expect(retryDelay(new AiError('server', 'oops'), 4, options)).toBeNull()
  })
})

describe('withRetry', () => {
  it('retries until the request succeeds, reporting each retry', async () => {
    const delays: number[] = []
    const onRetry = vi.fn()
    let calls = 0
    const result = await withRetry(
      async () => {
        calls++
        if (calls < 3)
          throw new AiError('rate-limit', 'slow down', { retryAfterMs: 2000 })
        return 'ok'
      },
      { ...instant(delays), onRetry },
    )
    expect(result).toBe('ok')
    expect(delays).toEqual([2000, 2000])
    expect(onRetry).toHaveBeenCalledTimes(2)
    expect(onRetry.mock.calls[0][0]).toMatchObject({
      attempt: 1,
      delayMs: 2000,
    })
  })

  it('gives up straight away on errors that retrying cannot fix', async () => {
    const run = vi.fn(async () => {
      throw new AiError('auth', 'bad key')
    })
    await expect(withRetry(run, instant())).rejects.toMatchObject({
      kind: 'auth',
    })
    expect(run).toHaveBeenCalledTimes(1)
  })

  it('stops after the last attempt', async () => {
    const run = vi.fn(async () => {
      throw new AiError('server', 'oops')
    })
    await expect(
      withRetry(run, { ...instant(), attempts: 3 }),
    ).rejects.toMatchObject({ kind: 'server' })
    expect(run).toHaveBeenCalledTimes(3)
  })

  it('pauses the whole provider after a rate limit', async () => {
    // The retry's own wait is instant here, so the next attempt has to wait
    // out the provider-wide pause at the gate (as any other request would).
    let now = 0
    const gateWaits: number[] = []
    const gate = new RequestGate(2, {
      now: () => now,
      sleep: async (ms) => {
        gateWaits.push(ms)
        now += ms
      },
    })
    let calls = 0
    await withRetry(
      async () => {
        if (calls++ === 0)
          throw new AiError('rate-limit', 'slow down', { retryAfterMs: 5000 })
      },
      { ...instant(), gate },
    )
    expect(calls).toBe(2)
    expect(gateWaits).toEqual([5000])
  })

  it('stops when cancelled', async () => {
    const controller = new AbortController()
    controller.abort()
    await expect(
      withRetry(async () => 'never', { signal: controller.signal }),
    ).rejects.toMatchObject({
      kind: 'aborted',
    })
  })
})

describe('streamWithRetry', () => {
  async function collect<T>(stream: AsyncIterable<T>): Promise<T[]> {
    const items: T[] = []
    for await (const item of stream) items.push(item)
    return items
  }

  it('retries a stream that fails before any output', async () => {
    let attempt = 0
    const items = await collect(
      streamWithRetry(async function* () {
        if (attempt++ === 0) throw new AiError('overloaded', 'busy')
        yield 'a'
        yield 'b'
      }, instant()),
    )
    expect(items).toEqual(['a', 'b'])
    expect(attempt).toBe(2)
  })

  it('never retries once output has been sent, so text is not repeated', async () => {
    let attempts = 0
    const stream = streamWithRetry(async function* () {
      attempts++
      yield 'a'
      throw new AiError('overloaded', 'busy')
    }, instant())
    await expect(collect(stream)).rejects.toMatchObject({ kind: 'overloaded' })
    expect(attempts).toBe(1)
  })

  it('treats only real output as progress', async () => {
    let attempt = 0
    const items = await collect(
      streamWithRetry(
        async function* () {
          yield 'usage'
          if (attempt++ === 0) throw new AiError('server', 'oops')
          yield 'text'
        },
        { ...instant(), isOutput: (item) => item === 'text' },
      ),
    )
    expect(items).toEqual(['usage', 'usage', 'text'])
  })

  it('frees its concurrency slot when the reader stops early', async () => {
    const gate = new RequestGate(1)
    const stream = streamWithRetry(
      async function* () {
        yield 1
        yield 2
      },
      { ...instant(), gate },
    )
    for await (const item of stream) {
      expect(gate.running).toBe(1)
      if (item === 1) break
    }
    expect(gate.running).toBe(0)
  })
})
