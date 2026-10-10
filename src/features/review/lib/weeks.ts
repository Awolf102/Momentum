import {
  addDays,
  dayOfWeek,
  startOfWeek,
  type DateKey,
  type Weekday,
} from '@/lib/date'

// Which week is which. Apart from the week's numbers (./week), so the
// dashboard can tell whether to show the week without loading them.

/** Weeks run Monday to Sunday, so the review lands on a Sunday. */
export const REVIEW_WEEK_START: Weekday = 1

export const weekOf = (day: DateKey): DateKey =>
  startOfWeek(day, REVIEW_WEEK_START)

/** The review shows on the dashboard on Sundays, and on Mondays for last week. */
export function reviewWeekToShow(today: DateKey): DateKey | null {
  const weekday = dayOfWeek(today)
  if (weekday === 0) return weekOf(today)
  if (weekday === 1) return weekOf(addDays(today, -1))
  return null
}
