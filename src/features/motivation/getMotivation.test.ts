import { describe, expect, it } from 'vitest'
import { getMotivation } from './getMotivation'
import { DAILY_MESSAGES, MILESTONE_MESSAGES } from './messages'

describe('getMotivation', () => {
  it('celebrates milestones', () => {
    expect(getMotivation({ streak: 7, date: '2026-10-10' })).toBe(
      MILESTONE_MESSAGES[7],
    )
    expect(getMotivation({ streak: 100, date: '2026-10-10' })).toBe(
      MILESTONE_MESSAGES[100],
    )
  })

  it('picks the same daily message for the same day', () => {
    const first = getMotivation({ streak: 12, date: '2026-10-10' })
    expect(getMotivation({ streak: 12, date: '2026-10-10' })).toBe(first)
    expect(DAILY_MESSAGES).toContain(first)
  })

  it('varies from day to day', () => {
    const week = Array.from({ length: 14 }, (_, day) =>
      getMotivation({
        streak: 12,
        date: `2026-10-${String(day + 1).padStart(2, '0')}`,
      }),
    )
    expect(new Set(week).size).toBeGreaterThan(5)
  })
})
