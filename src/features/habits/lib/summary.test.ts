import { describe, expect, it } from 'vitest'
import type { Weekday } from '@/lib/date'
import { describeSchedule, lastWeek, summarizeHabit } from './summary'

// Saturday 10 October 2026.
const today = '2026-10-10'
const days = (...list: string[]) => new Set(list)
const MWF: Weekday[] = [1, 3, 5]

describe('a daily habit', () => {
  it('counts days in a row, with today open until done', () => {
    const done = days('2026-10-07', '2026-10-08', '2026-10-09')
    expect(summarizeHabit(done, today, [], '2026-10-01')).toMatchObject({
      current: 3,
      longest: 3,
      total: 3,
      doneToday: false,
      dueToday: true,
    })
    done.add(today)
    expect(summarizeHabit(done, today, [], '2026-10-01').current).toBe(4)
  })

  it('ends the run on a missed day', () => {
    const done = days('2026-10-05', '2026-10-06', '2026-10-07', '2026-10-09')
    expect(summarizeHabit(done, today, [], '2026-10-01')).toMatchObject({
      current: 1,
      longest: 3,
    })
    expect(
      summarizeHabit(days('2026-10-07'), today, [], '2026-10-01').current,
    ).toBe(0)
  })

  it("doesn't count days before the habit existed", () => {
    expect(
      summarizeHabit(days('2026-10-09'), today, [], '2026-10-09').rate,
    ).toBe(1)
  })
})

describe('a habit on some days', () => {
  it('runs across days off, and only breaks on a missed scheduled day', () => {
    // Mon 5, Wed 7, Fri 9 done; today (Sat) is a day off.
    const done = days('2026-10-05', '2026-10-07', '2026-10-09')
    expect(summarizeHabit(done, today, MWF, '2026-10-01')).toMatchObject({
      current: 3,
      dueToday: false,
    })
    // Missing Wednesday breaks it.
    expect(
      summarizeHabit(days('2026-10-05', '2026-10-09'), today, MWF, '2026-10-01')
        .current,
    ).toBe(1)
  })

  it('counts extra days in the total but not the run', () => {
    const done = days('2026-10-09', today)
    expect(summarizeHabit(done, today, MWF, '2026-10-08')).toMatchObject({
      current: 1,
      total: 2,
      doneToday: true,
    })
  })

  it('works out the last four weeks as a share of scheduled days', () => {
    // From Mon 28 Sep: 6 scheduled days up to Fri 9 Oct, 3 done.
    const done = days('2026-09-28', '2026-10-02', '2026-10-09')
    expect(summarizeHabit(done, today, MWF, '2026-09-28').rate).toBeCloseTo(
      3 / 6,
    )
  })

  it('describes the schedule and the week', () => {
    expect(describeSchedule([])).toBe('Every day')
    expect(describeSchedule([5, 3, 1])).toBe('Mon, Wed and Fri')
    expect(describeSchedule([1, 2, 3, 4, 5])).toBe('Weekdays')
    expect(describeSchedule([0, 6])).toBe('Weekends')
    expect(describeSchedule([2])).toBe('Tuesdays')
    const week = lastWeek(days('2026-10-05'), today, MWF, '2026-10-01')
    expect(week.map((dot) => dot.state)).toEqual([
      'off', // Sun 4
      'done', // Mon 5
      'off', // Tue 6
      'missed', // Wed 7
      'off', // Thu 8
      'missed', // Fri 9
      'off', // Sat 10 (today, not scheduled)
    ])
  })
})
