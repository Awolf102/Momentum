import { describe, expect, it } from 'vitest'
import { msUntilReminder, reminderDue, type ReminderMirror } from './schedule'

const state = (overrides: Partial<ReminderMirror> = {}): ReminderMirror => ({
  enabled: true,
  time: '20:00',
  lastCheckIn: '2026-10-09',
  lastNotified: null,
  streak: 12,
  ...overrides,
})
const at = (hours: number, minutes = 0) => new Date(2026, 9, 10, hours, minutes)

describe('reminderDue', () => {
  it('fires after the reminder time if you have not checked in', () => {
    expect(reminderDue(state(), at(19, 59))).toBe(false)
    expect(reminderDue(state(), at(20, 0))).toBe(true)
    expect(reminderDue(state(), at(23, 30))).toBe(true)
  })

  it('stays quiet once you have checked in, or were already reminded today', () => {
    expect(reminderDue(state({ lastCheckIn: '2026-10-10' }), at(21))).toBe(
      false,
    )
    expect(reminderDue(state({ lastNotified: '2026-10-10' }), at(21))).toBe(
      false,
    )
    expect(reminderDue(state({ enabled: false }), at(21))).toBe(false)
  })
})

describe('msUntilReminder', () => {
  it('counts down to today or tomorrow', () => {
    expect(msUntilReminder('20:00', at(19, 30))).toBe(30 * 60_000)
    expect(msUntilReminder('20:00', at(20, 30))).toBe(23.5 * 3_600_000)
  })
})
