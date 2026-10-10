import {
  addDays,
  addMonths,
  daysBetween,
  startOfWeek,
  type DateKey,
  type Weekday,
} from '@/lib/date'

/**
 * The stretch of time the charts look back over, cut into the columns they
 * draw: four weeks by day, three months by week, a year by month.
 */

export type Period = 'month' | 'quarter' | 'year'
export const PERIODS: readonly Period[] = ['month', 'quarter', 'year']

export type Unit = 'day' | 'week' | 'month'

/** One column of a chart: the days from `start` to `end`, inclusive. */
export interface Bucket {
  start: DateKey
  end: DateKey
}

export interface Range {
  /** The first day looked at, and the last (today). */
  from: DateKey
  to: DateKey
  unit: Unit
  buckets: Bucket[]
}

/** Weeks start on Monday here, as in the weekly review. */
export const ANALYTICS_WEEK_START: Weekday = 1

export function periodRange(period: Period, today: DateKey): Range {
  if (period === 'month') {
    const from = addDays(today, -27)
    return {
      from,
      to: today,
      unit: 'day',
      buckets: Array.from({ length: 28 }, (_, index) => {
        const day = addDays(from, index)
        return { start: day, end: day }
      }),
    }
  }
  if (period === 'quarter') {
    const from = addDays(startOfWeek(today, ANALYTICS_WEEK_START), -12 * 7)
    return {
      from,
      to: today,
      unit: 'week',
      buckets: Array.from({ length: 13 }, (_, index) => {
        const start = addDays(from, index * 7)
        return { start, end: addDays(start, 6) }
      }),
    }
  }
  const from = addMonths(`${today.slice(0, 7)}-01`, -11)
  return {
    from,
    to: today,
    unit: 'month',
    buckets: Array.from({ length: 12 }, (_, index) => {
      const start = addMonths(from, index)
      return { start, end: addDays(addMonths(start, 1), -1) }
    }),
  }
}

/** The column a day falls in, or -1 outside the range. */
export function bucketIndex(buckets: readonly Bucket[], day: DateKey): number {
  if (!buckets.length || day < buckets[0].start) return -1
  if (day > buckets[buckets.length - 1].end) return -1
  // Columns are in order and touch, so a binary search finds it.
  let low = 0
  let high = buckets.length - 1
  while (low <= high) {
    const middle = (low + high) >> 1
    if (day < buckets[middle].start) high = middle - 1
    else if (day > buckets[middle].end) low = middle + 1
    else return middle
  }
  return -1
}

/** Days in a range, so far (`to` is today). */
export const daysIn = (range: Pick<Range, 'from' | 'to'>) =>
  daysBetween(range.from, range.to) + 1
