import { describe, expect, it } from 'vitest'
import {
  recallBetween,
  recallByBucket,
  recallRate,
  reviewCounts,
  type ReviewLike,
} from './lib/cards'
import {
  bestHours,
  focusByBucket,
  focusByHour,
  focusBySubject,
  focusByWeekday,
  type SessionLike,
} from './lib/focus'
import { bucketIndex, daysIn, periodRange } from './lib/period'
import { streakHeights, streakHistory, streakRuns } from './lib/streaks'
import {
  completionBetween,
  completionByBucket,
  completionRate,
  finishedByBucket,
  type TaskLike,
} from './lib/tasks'

// Tests run in Australia/Sydney: local times below are Sydney's.
const at = (day: string, time: string) =>
  new Date(`${day}T${time}:00`).toISOString()
const session = (
  day: string,
  start: string,
  end: string,
  minutes: number,
  subjectId: string | null = null,
): SessionLike => ({
  day,
  startedAt: at(day, start),
  endedAt: at(day, end),
  durationMs: minutes * 60_000,
  subjectId,
})

describe('periods', () => {
  it('looks back four weeks by day', () => {
    const range = periodRange('month', '2026-10-11')
    expect(range).toMatchObject({
      from: '2026-09-14',
      to: '2026-10-11',
      unit: 'day',
    })
    expect(range.buckets).toHaveLength(28)
    expect(range.buckets[27]).toEqual({
      start: '2026-10-11',
      end: '2026-10-11',
    })
    expect(daysIn(range)).toBe(28)
  })

  it('looks back three months by week, Monday to Sunday', () => {
    const range = periodRange('quarter', '2026-10-14') // a Wednesday
    expect(range.unit).toBe('week')
    expect(range.buckets).toHaveLength(13)
    expect(range.buckets[12]).toEqual({
      start: '2026-10-12',
      end: '2026-10-18',
    })
    expect(range.buckets[0]).toEqual({ start: '2026-07-20', end: '2026-07-26' })
    expect(range.from).toBe('2026-07-20')
  })

  it('looks back a year by month, the months as they fall', () => {
    const range = periodRange('year', '2026-03-31')
    expect(range.unit).toBe('month')
    expect(range.buckets).toHaveLength(12)
    expect(range.buckets[0]).toEqual({ start: '2025-04-01', end: '2025-04-30' })
    expect(range.buckets[10]).toEqual({
      start: '2026-02-01',
      end: '2026-02-28',
    })
    expect(range.buckets[11]).toEqual({
      start: '2026-03-01',
      end: '2026-03-31',
    })
  })

  it('finds the column a day is in', () => {
    const { buckets } = periodRange('year', '2026-10-11')
    expect(bucketIndex(buckets, '2025-11-01')).toBe(0)
    expect(bucketIndex(buckets, '2026-02-28')).toBe(3)
    expect(bucketIndex(buckets, '2026-10-31')).toBe(11)
    expect(bucketIndex(buckets, '2025-10-31')).toBe(-1)
    expect(bucketIndex(buckets, '2026-11-01')).toBe(-1)
    expect(bucketIndex([], '2026-10-11')).toBe(-1)
  })
})

describe('focus', () => {
  const sessions: SessionLike[] = [
    session('2026-10-05', '09:00', '09:25', 25, 'calculus'),
    session('2026-10-05', '09:50', '10:20', 30, 'logic'),
    session('2026-10-06', '20:00', '20:50', 50, 'logic'),
    session('2026-10-07', '14:00', '14:25', 25),
    {
      ...session('2026-10-07', '15:00', '15:25', 25, 'calculus'),
      deletedAt: '2026-10-08T00:00:00Z',
    },
    session('2026-09-01', '09:00', '09:25', 25, 'calculus'),
  ]

  it('adds up each subject over the period, most first, leaving deleted sessions out', () => {
    expect(focusBySubject(sessions, '2026-10-01', '2026-10-11')).toEqual([
      { subjectId: 'logic', minutes: 80, sessions: 2 },
      { subjectId: 'calculus', minutes: 25, sessions: 1 },
      { subjectId: null, minutes: 25, sessions: 1 },
    ])
  })

  it('splits each column by subject', () => {
    const buckets = [
      { start: '2026-10-05', end: '2026-10-05' },
      { start: '2026-10-06', end: '2026-10-06' },
      { start: '2026-10-07', end: '2026-10-07' },
    ]
    const columns = focusByBucket(sessions, buckets)
    expect(columns.map((each) => each.minutes)).toEqual([55, 50, 25])
    expect(Object.fromEntries(columns[0].bySubject)).toEqual({
      calculus: 25,
      logic: 30,
    })
    expect(Object.fromEntries(columns[2].bySubject)).toEqual({ '': 25 })
  })

  it('spreads a session over the hours it ran, in local time', () => {
    const hours = focusByHour(sessions, '2026-10-01', '2026-10-11')
    expect(hours[9]).toBe(35) // 25, and a third of the 9:50 one
    expect(hours[10]).toBe(20) // two thirds of it
    expect(hours[20]).toBe(50)
    expect(hours[14]).toBe(25)
    expect(hours.reduce((sum, each) => sum + each, 0)).toBe(130)
  })

  it('counts focused time only, spread over a paused session', () => {
    // 25 minutes focused between 23:30 and 00:20 (paused for 25): half
    // each side of midnight, by the clock.
    const late = {
      ...session('2026-10-08', '23:30', '23:30', 25),
      endedAt: at('2026-10-09', '00:20'),
    }
    const hours = focusByHour([late], '2026-10-08', '2026-10-08')
    expect(hours[23]).toBe(15)
    expect(hours[0]).toBe(10)
  })

  it('keeps an hour the clocks repeat from looping', () => {
    // Sydney's clocks went back at 3 am on 5 April 2026.
    const night = {
      ...session('2026-04-05', '01:30', '01:30', 60),
      startedAt: '2026-04-04T14:30:00.000Z', // 1:30 am (+11)
      endedAt: '2026-04-04T16:30:00.000Z', // 2:30 am (+10), two hours later
    }
    const hours = focusByHour([night], '2026-04-05', '2026-04-05')
    expect(hours.reduce((sum, each) => sum + each, 0)).toBeCloseTo(60, 5)
    expect(hours[1]).toBe(15)
  })

  it('finds the best two hours, wrapping past midnight, and their share', () => {
    const hours = Array.from({ length: 24 }, () => 0)
    hours[9] = 40
    hours[10] = 30
    hours[20] = 60
    expect(bestHours(hours)).toEqual({
      start: 9,
      end: 11,
      minutes: 70,
      share: 70 / 130,
    })
    hours[23] = 30
    hours[0] = 45
    expect(bestHours(hours)).toEqual({
      start: 23,
      end: 1,
      minutes: 75,
      share: 75 / 205,
    })
    expect(bestHours(Array.from({ length: 24 }, () => 0))).toBeNull()
  })

  it('adds up the weekdays, Monday first', () => {
    expect(focusByWeekday(sessions, '2026-10-01', '2026-10-11')).toEqual([
      55, 50, 25, 0, 0, 0, 0,
    ])
  })
})

describe('streak history', () => {
  const days = [
    '2026-09-28',
    '2026-09-29',
    '2026-09-30',
    '2026-10-02',
    '2026-10-03',
    '2026-10-08',
  ]
  const runs = streakRuns(days)

  it('finds the runs of check-ins', () => {
    expect(runs).toEqual([
      { start: '2026-09-28', end: '2026-09-30', days: 3 },
      { start: '2026-10-02', end: '2026-10-03', days: 2 },
      { start: '2026-10-08', end: '2026-10-08', days: 1 },
    ])
    expect(streakRuns([])).toEqual([])
  })

  it('gives the streak on each day, counting days before the period', () => {
    expect(streakHeights(runs, '2026-09-29', '2026-10-09')).toEqual([
      2, 3, 0, 1, 2, 0, 0, 0, 0, 1, 0,
    ])
  })

  it('sums up the period: the longest runs, days checked in, runs started', () => {
    expect(streakHistory(runs, '2026-09-29', '2026-10-09')).toEqual({
      longest: runs[0],
      longestInPeriod: runs[0],
      checkedIn: 5,
      days: 11,
      started: 2,
    })
    expect(streakHistory(runs, '2026-10-05', '2026-10-11')).toMatchObject({
      longest: runs[0],
      longestInPeriod: runs[2],
      checkedIn: 1,
      started: 1,
    })
  })
})

describe('tasks', () => {
  const task = (
    due: string | null,
    done?: string,
    extra: Partial<TaskLike> = {},
  ): TaskLike => ({
    status: done ? 'done' : 'todo',
    due,
    completedAt: done ? at(done, '18:00') : null,
    ...extra,
  })
  const today = '2026-10-11'
  const tasks = [
    task('2026-10-05', '2026-10-05'), // on time
    task('2026-10-05', '2026-10-07'), // late
    task('2026-10-06'), // missed, still open
    task('2026-10-11'), // due today, not yet late
    task('2026-10-11', '2026-10-11'), // due today, done
    task('2026-10-15'), // later
    task(null, '2026-10-06'), // undated, done
    task('2026-10-06', undefined, { deletedAt: '2026-10-07T00:00:00Z' }),
    task('2026-10-06', undefined, { status: 'done' }), // done long ago, no time
  ]

  it('counts tasks due in the period: on time, late, still open', () => {
    const total = completionBetween(tasks, '2026-10-05', '2026-10-11', today)
    expect(total).toEqual({ due: 5, onTime: 3, late: 1, open: 1 })
    expect(completionRate(total)).toBe(4 / 5)
    expect(completionRate({ due: 0, onTime: 0, late: 0, open: 0 })).toBeNull()
  })

  it('by the day each was due', () => {
    const buckets = [
      { start: '2026-10-05', end: '2026-10-05' },
      { start: '2026-10-06', end: '2026-10-06' },
      { start: '2026-10-11', end: '2026-10-11' },
    ]
    expect(completionByBucket(tasks, buckets, today)).toEqual([
      { due: 2, onTime: 1, late: 1, open: 0 },
      { due: 2, onTime: 1, late: 0, open: 1 },
      { due: 1, onTime: 1, late: 0, open: 0 },
    ])
  })

  it('counts tasks finished by the local day they were done, dated or not', () => {
    const buckets = [
      { start: '2026-10-05', end: '2026-10-06' },
      { start: '2026-10-07', end: '2026-10-11' },
    ]
    expect(finishedByBucket(tasks, buckets)).toEqual([2, 2])
    // Done at 9 am in Sydney is the day before in UTC; it counts that morning.
    const morning = {
      status: 'done',
      due: null,
      completedAt: at('2026-10-07', '09:00'),
    }
    expect(finishedByBucket([morning], buckets)).toEqual([0, 1])
  })
})

describe('card recall', () => {
  const review = (
    day: string,
    rating: number,
    state = 'review',
  ): ReviewLike => ({ day, rating, state })
  const reviews = [
    review('2026-10-05', 3),
    review('2026-10-05', 1),
    review('2026-10-06', 4),
    review('2026-10-06', 2),
    review('2026-10-06', 1, 'learning'),
    review('2026-10-06', 3, 'new'),
    { ...review('2026-10-06', 3), deletedAt: '2026-10-06T10:00:00Z' },
    review('2026-09-01', 1),
  ]

  it('is remembered, of cards due for review', () => {
    const total = recallBetween(reviews, '2026-10-01', '2026-10-11')
    expect(total).toEqual({ reviewed: 4, recalled: 3 })
    expect(recallRate(total)).toBe(0.75)
    expect(recallRate({ reviewed: 0, recalled: 0 })).toBeNull()
  })

  it('by column', () => {
    expect(
      recallByBucket(reviews, [
        { start: '2026-10-05', end: '2026-10-05' },
        { start: '2026-10-06', end: '2026-10-06' },
      ]),
    ).toEqual([
      { reviewed: 2, recalled: 1 },
      { reviewed: 2, recalled: 2 },
    ])
  })

  it('counts every rating, and the days studied', () => {
    expect(reviewCounts(reviews, '2026-10-01', '2026-10-11')).toEqual({
      ratings: 6,
      byRating: [2, 1, 2, 1],
      days: 2,
    })
  })
})
