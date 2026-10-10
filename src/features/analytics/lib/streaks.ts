import { addDays, daysBetween, type DateKey } from '@/lib/date'

/** An unbroken run of check-in days. */
export interface Run {
  start: DateKey
  end: DateKey
  days: number
}

/** Every run of check-ins, oldest first, from days sorted and unique. */
export function streakRuns(dates: readonly DateKey[]): Run[] {
  const runs: Run[] = []
  for (const day of dates) {
    const last = runs[runs.length - 1]
    if (last && daysBetween(last.end, day) === 1) {
      last.end = day
      last.days++
    } else runs.push({ start: day, end: day, days: 1 })
  }
  return runs
}

/**
 * For each day from `from` to `to`, how many days into a run it was (0 when
 * there was no check-in), counting days before `from` too: the streak's
 * height over time.
 */
export function streakHeights(
  runs: readonly Run[],
  from: DateKey,
  to: DateKey,
): number[] {
  const length = daysBetween(from, to) + 1
  const heights = Array.from({ length }, () => 0)
  for (const run of runs) {
    if (run.end < from || run.start > to) continue
    for (
      let day = run.start < from ? from : run.start;
      day <= run.end && day <= to;
      day = addDays(day, 1)
    )
      heights[daysBetween(from, day)] = daysBetween(run.start, day) + 1
  }
  return heights
}

export interface StreakHistory {
  /** The longest run ever, and the longest that touched the period. */
  longest: Run | null
  longestInPeriod: Run | null
  /** Days checked in during the period, of the days in it. */
  checkedIn: number
  days: number
  /** Runs that started in the period. */
  started: number
}

export function streakHistory(
  runs: readonly Run[],
  from: DateKey,
  to: DateKey,
): StreakHistory {
  const longer = (best: Run | null, run: Run) =>
    !best || run.days > best.days ? run : best
  let longest: Run | null = null
  let longestInPeriod: Run | null = null
  let checkedIn = 0
  let started = 0
  for (const run of runs) {
    longest = longer(longest, run)
    if (run.end < from || run.start > to) continue
    longestInPeriod = longer(longestInPeriod, run)
    if (run.start >= from) started++
    const first = run.start < from ? from : run.start
    const last = run.end > to ? to : run.end
    checkedIn += daysBetween(first, last) + 1
  }
  return {
    longest,
    longestInPeriod,
    checkedIn,
    days: daysBetween(from, to) + 1,
    started,
  }
}
