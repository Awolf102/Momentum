import { getLocaleWeekStart, type Weekday } from './date'

/** The user's first day of the week, from their browser locale. */
export const weekStartsOn: Weekday = getLocaleWeekStart()

/** Whether the user's locale writes the day before the month (12/10 = 12 Oct). */
export const dayFirst: boolean = (() => {
  try {
    const parts = new Intl.DateTimeFormat(undefined, {
      day: 'numeric',
      month: 'numeric',
    }).formatToParts(new Date(2026, 11, 25))
    const day = parts.findIndex((part) => part.type === 'day')
    const month = parts.findIndex((part) => part.type === 'month')
    return day < month
  } catch {
    return true
  }
})()
