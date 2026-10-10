import { abortError } from '../errors'
import { sleep as defaultSleep } from './retry'

interface Waiter {
  resolve: () => void
  reject: (error: unknown) => void
}

/**
 * Limits how many requests run at once against one provider, and pauses them
 * all for a while after a rate limit so they don't pile on.
 */
export class RequestGate {
  private active = 0
  private waiting: Waiter[] = []
  private resumeAt = 0
  private readonly max: number
  private readonly now: () => number
  private readonly sleep: (ms: number, signal?: AbortSignal) => Promise<void>

  constructor(
    max: number,
    options: {
      now?: () => number
      sleep?: (ms: number, signal?: AbortSignal) => Promise<void>
    } = {},
  ) {
    this.max = max
    this.now = options.now ?? Date.now
    this.sleep = options.sleep ?? defaultSleep
  }

  get running(): number {
    return this.active
  }

  /** Milliseconds left in the current rate-limit pause. */
  get cooldownMs(): number {
    return Math.max(0, this.resumeAt - this.now())
  }

  /** Pauses new requests for at least `ms`. */
  coolDown(ms: number): void {
    this.resumeAt = Math.max(this.resumeAt, this.now() + ms)
  }

  /** Waits for a free slot (and the end of any pause). Call the result to release it. */
  async acquire(signal?: AbortSignal): Promise<() => void> {
    for (;;) {
      if (signal?.aborted) throw abortError()
      const pause = this.cooldownMs
      if (pause > 0) {
        await this.sleep(pause, signal)
        continue
      }
      if (this.active < this.max) break
      await this.wait(signal)
    }
    this.active++
    let released = false
    return () => {
      if (released) return
      released = true
      this.active--
      this.waiting.shift()?.resolve()
    }
  }

  private wait(signal?: AbortSignal): Promise<void> {
    return new Promise((resolve, reject) => {
      const waiter: Waiter = {
        resolve: () => {
          signal?.removeEventListener('abort', onAbort)
          resolve()
        },
        reject,
      }
      const onAbort = () => {
        this.waiting = this.waiting.filter((entry) => entry !== waiter)
        reject(abortError())
      }
      signal?.addEventListener('abort', onAbort, { once: true })
      this.waiting.push(waiter)
    })
  }
}
