import { describe, expect, it } from 'vitest'
import type { Weekday } from '@/lib/date'
import type { Recurrence } from '../types'
import {
  describeRecurrence,
  firstOnOrAfter,
  nextDue,
  stepAfter,
} from './recurrence'

const rule = (
  unit: Recurrence['unit'],
  anchor: string,
  interval = 1,
  weekdays: Weekday[] = [],
): Recurrence => ({ unit, interval, weekdays, anchor })

// 2026-10-10 is a Saturday.
describe('stepping through a schedule', () => {
  it('counts days and weeks from the anchor', () => {
    expect(stepAfter('2026-10-10', rule('day', '2026-10-10'))).toBe(
      '2026-10-11',
    )
    expect(stepAfter('2026-10-10', rule('day', '2026-10-10', 3))).toBe(
      '2026-10-13',
    )
    expect(stepAfter('2026-10-11', rule('day', '2026-10-10', 3))).toBe(
      '2026-10-13',
    )
    expect(stepAfter('2026-10-10', rule('week', '2026-10-10'))).toBe(
      '2026-10-17',
    )
    expect(stepAfter('2026-10-10', rule('week', '2026-10-10', 2))).toBe(
      '2026-10-24',
    )
  })

  it('walks through chosen weekdays', () => {
    const monThu = rule('week', '2026-10-12', 1, [1, 4])
    expect(stepAfter('2026-10-12', monThu)).toBe('2026-10-15')
    expect(stepAfter('2026-10-15', monThu)).toBe('2026-10-19')
    // Every other week, on Monday and Thursday.
    const fortnightly = rule('week', '2026-10-12', 2, [1, 4])
    expect(stepAfter('2026-10-15', fortnightly)).toBe('2026-10-26')
  })

  it('keeps the day of the month, even through short months', () => {
    const monthly = rule('month', '2026-01-31')
    expect(stepAfter('2026-01-31', monthly)).toBe('2026-02-28')
    expect(stepAfter('2026-02-28', monthly)).toBe('2026-03-31')
    expect(stepAfter('2026-03-31', rule('month', '2026-01-31', 3))).toBe(
      '2026-04-30',
    )
    expect(stepAfter('2028-02-29', rule('year', '2028-02-29'))).toBe(
      '2029-02-28',
    )
  })

  it('starts a new repeating task on its first date', () => {
    expect(
      firstOnOrAfter('2026-10-10', rule('week', '2026-10-10', 1, [1])),
    ).toBe('2026-10-12')
    expect(
      firstOnOrAfter('2026-10-12', rule('week', '2026-10-12', 1, [1])),
    ).toBe('2026-10-12')
  })
})

describe('the next occurrence after finishing one', () => {
  it('follows the schedule when done on time or early', () => {
    const weekly = rule('week', '2026-10-12', 1, [1])
    expect(nextDue('2026-10-12', weekly, '2026-10-12')).toBe('2026-10-19')
    // Done on Saturday, ahead of Monday: next is the Monday after.
    expect(nextDue('2026-10-12', weekly, '2026-10-10')).toBe('2026-10-19')
  })

  it('skips occurrences that were missed', () => {
    const daily = rule('day', '2026-01-01')
    expect(nextDue('2026-10-01', daily, '2026-10-10')).toBe('2026-10-11')
    const weekly = rule('week', '2026-09-07', 1, [1])
    expect(nextDue('2026-09-07', weekly, '2026-10-10')).toBe('2026-10-12')
    const monthly = rule('month', '2026-01-31')
    expect(nextDue('2026-05-31', monthly, '2026-10-10')).toBe('2026-10-31')
  })
})

describe('describing a schedule', () => {
  it('reads like people say it', () => {
    expect(describeRecurrence(rule('day', '2026-10-10'))).toBe('Every day')
    expect(describeRecurrence(rule('day', '2026-10-10', 3))).toBe(
      'Every 3 days',
    )
    expect(describeRecurrence(rule('week', '2026-10-10'))).toBe('Every week')
    expect(describeRecurrence(rule('week', '2026-10-12', 1, [4, 1]))).toBe(
      'Every Mon and Thu',
    )
    expect(
      describeRecurrence(rule('week', '2026-10-12', 1, [1, 2, 3, 4, 5])),
    ).toBe('Every weekday')
    expect(describeRecurrence(rule('week', '2026-10-10', 1, [0, 6]))).toBe(
      'Every weekend',
    )
    expect(describeRecurrence(rule('week', '2026-10-12', 2, [1, 3, 5]))).toBe(
      'Every 2 weeks on Mon, Wed and Fri',
    )
    expect(describeRecurrence(rule('month', '2026-01-31'))).toBe(
      'Every month on the 31st',
    )
    expect(describeRecurrence(rule('year', '2026-10-10'))).toBe('Every year')
  })
})
