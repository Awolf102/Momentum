import { describe, expect, it } from 'vitest'
import { RequestGate } from './gate'

describe('RequestGate', () => {
  it('runs at most `max` requests at once, in order', async () => {
    const gate = new RequestGate(2)
    const order: string[] = []
    const first = await gate.acquire()
    const second = await gate.acquire()
    const third = gate.acquire().then((release) => {
      order.push('third')
      return release
    })
    await Promise.resolve()
    expect(order).toEqual([])
    expect(gate.running).toBe(2)
    first()
    const releaseThird = await third
    expect(order).toEqual(['third'])
    expect(gate.running).toBe(2)
    second()
    releaseThird()
    expect(gate.running).toBe(0)
  })

  it('ignores a second release of the same slot', async () => {
    const gate = new RequestGate(1)
    const release = await gate.acquire()
    release()
    release()
    expect(gate.running).toBe(0)
  })

  it('waits out a rate-limit pause before starting', async () => {
    let now = 1000
    const waits: number[] = []
    const gate = new RequestGate(2, {
      now: () => now,
      sleep: async (ms) => {
        waits.push(ms)
        now += ms
      },
    })
    gate.coolDown(3000)
    gate.coolDown(1000) // a shorter pause never cuts a longer one short
    const release = await gate.acquire()
    expect(waits).toEqual([3000])
    release()
  })

  it('stops waiting when cancelled', async () => {
    const gate = new RequestGate(1)
    const held = await gate.acquire()
    const controller = new AbortController()
    const waiting = gate.acquire(controller.signal)
    controller.abort()
    await expect(waiting).rejects.toMatchObject({ kind: 'aborted' })
    held()
    // The cancelled request didn't take the freed slot.
    expect(gate.running).toBe(0)
  })
})
