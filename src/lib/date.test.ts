import { describe, expect, it } from 'vitest'
import {
  addDays,
  dayOfWeek,
  daysBetween,
  formatDateKey,
  isDateKey,
  msUntilNextDay,
  startOfWeek,
  toDateKey,
} from './date'

describe('toDateKey', () => {
  it('uses the local calendar day, not UTC', () => {
    // Tests run in Australia/Sydney (UTC+10/11). 11:30pm local is still the
    // same local day even though it's already "tomorrow"… or "today" in UTC.
    expect(toDateKey(new Date(2026, 9, 10, 23, 30))).toBe('2026-10-10')
    expect(toDateKey(new Date(2026, 9, 10, 0, 5))).toBe('2026-10-10')
  })

  it('pads months and days', () => {
    expect(toDateKey(new Date(2026, 0, 5))).toBe('2026-01-05')
  })
})

describe('isDateKey', () => {
  it('accepts real dates only', () => {
    expect(isDateKey('2026-10-10')).toBe(true)
    expect(isDateKey('2024-02-29')).toBe(true)
    expect(isDateKey('2026-02-29')).toBe(false)
    expect(isDateKey('2026-13-01')).toBe(false)
    expect(isDateKey('2026-1-1')).toBe(false)
    expect(isDateKey(20261010)).toBe(false)
  })
})

describe('addDays / daysBetween', () => {
  it('crosses month, year and leap-day boundaries', () => {
    expect(addDays('2026-01-31', 1)).toBe('2026-02-01')
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDays('2024-02-28', 1)).toBe('2024-02-29')
    expect(addDays('2024-03-01', -1)).toBe('2024-02-29')
    expect(daysBetween('2024-02-28', '2024-03-01')).toBe(2)
  })

  it('is unaffected by daylight saving transitions', () => {
    // Sydney: DST starts 2026-10-04, ends 2026-04-05.
    expect(addDays('2026-10-03', 1)).toBe('2026-10-04')
    expect(addDays('2026-10-04', 1)).toBe('2026-10-05')
    expect(daysBetween('2026-10-03', '2026-10-05')).toBe(2)
    expect(daysBetween('2026-04-04', '2026-04-06')).toBe(2)
  })

  it('is negative when going backwards', () => {
    expect(daysBetween('2026-10-10', '2026-10-01')).toBe(-9)
  })
})

describe('weeks', () => {
  it('knows the day of the week', () => {
    expect(dayOfWeek('2026-10-10')).toBe(6) // Saturday
    expect(dayOfWeek('2026-10-11')).toBe(0) // Sunday
  })

  it('finds the start of the week for either convention', () => {
    expect(startOfWeek('2026-10-10', 1)).toBe('2026-10-05') // Monday
    expect(startOfWeek('2026-10-10', 0)).toBe('2026-10-04') // Sunday
    expect(startOfWeek('2026-10-05', 1)).toBe('2026-10-05')
  })
})

describe('formatDateKey', () => {
  it('formats the calendar day regardless of time zone', () => {
    expect(
      formatDateKey('2026-10-10', { month: 'short', day: 'numeric' }, 'en-US'),
    ).toBe('Oct 10')
  })
})

describe('msUntilNextDay', () => {
  it('counts down to local midnight', () => {
    expect(msUntilNextDay(new Date(2026, 9, 10, 23, 59, 0))).toBe(60_000)
  })
})
