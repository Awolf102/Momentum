import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  checkIn,
  isCheckedIn,
  onCheckIn,
  resetStreak,
  streakStore,
} from './store'

beforeEach(() => resetStreak())

describe('checkIn', () => {
  it('records today once, telling listeners which day', () => {
    const listener = vi.fn()
    const stop = onCheckIn(listener)
    const morning = new Date(2026, 9, 10, 9, 0)
    expect(checkIn(morning)).toBe(true)
    expect(checkIn(new Date(2026, 9, 10, 18, 0))).toBe(false)
    expect(listener).toHaveBeenCalledTimes(1)
    expect(listener).toHaveBeenCalledWith('2026-10-10')
    expect(streakStore.get().checkIns['2026-10-10']).toEqual({
      at: morning.toISOString(),
    })
    stop()
  })

  it('can check in a named day, e.g. the day a late session started', () => {
    // A session started at 23:50 on the 10th and finished after midnight.
    const finished = new Date(2026, 9, 11, 0, 15)
    expect(checkIn(finished, { day: '2026-10-10' })).toBe(true)
    expect(isCheckedIn('2026-10-10')).toBe(true)
    expect(isCheckedIn('2026-10-11')).toBe(false)
    expect(streakStore.get().checkIns['2026-10-10'].at).toBe(
      finished.toISOString(),
    )
  })
})
