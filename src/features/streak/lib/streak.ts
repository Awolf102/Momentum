import { daysBetween, isDateKey, type DateKey } from '@/lib/date'
import type { StreakData, StreakSummary } from '../types'

/** Valid check-in days in chronological order. */
export function sortedCheckInDates(data: StreakData): DateKey[] {
  return Object.keys(data.checkIns).filter(isDateKey).sort()
}

/**
 * Derives every streak number from the check-in history.
 *
 * @param dates check-in days, sorted ascending and unique
 * @param today the current local day
 */
export function summarizeStreak(
  dates: readonly DateKey[],
  today: DateKey,
): StreakSummary {
  // Ignore days "from the future" (e.g. the device clock was changed).
  const history = dates.filter((date) => date <= today)

  if (history.length === 0) {
    return {
      status: 'new',
      current: 0,
      longest: 0,
      total: 0,
      checkedInToday: false,
      firstCheckIn: null,
      lastCheckIn: null,
      previous: 0,
    }
  }

  let run = 0
  let longest = 0
  let previousDate: DateKey | null = null
  for (const date of history) {
    run =
      previousDate !== null && daysBetween(previousDate, date) === 1
        ? run + 1
        : 1
    longest = Math.max(longest, run)
    previousDate = date
  }

  const lastCheckIn = history[history.length - 1]
  const daysSinceLast = daysBetween(lastCheckIn, today)
  const alive = daysSinceLast <= 1

  return {
    status: daysSinceLast === 0 ? 'done' : alive ? 'pending' : 'broken',
    current: alive ? run : 0,
    longest,
    total: history.length,
    checkedInToday: daysSinceLast === 0,
    firstCheckIn: history[0],
    lastCheckIn,
    previous: alive ? 0 : run,
  }
}

/**
 * How deep into a streak each day was: 1 for the first day of a run, 2 for the
 * second, and so on. Used to make long runs glow brighter on the calendar.
 */
export function streakDepths(dates: readonly DateKey[]): Map<DateKey, number> {
  const depths = new Map<DateKey, number>()
  let previousDate: DateKey | null = null
  let run = 0
  for (const date of dates) {
    run =
      previousDate !== null && daysBetween(previousDate, date) === 1
        ? run + 1
        : 1
    depths.set(date, run)
    previousDate = date
  }
  return depths
}

/** Maps a streak depth onto the calendar's four intensity levels. */
export function depthToLevel(depth: number): number {
  if (depth <= 0) return 0
  if (depth === 1) return 1
  if (depth <= 3) return 2
  if (depth <= 6) return 3
  return 4
}
