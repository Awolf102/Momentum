import { getLocaleWeekStart, type Weekday } from './date'

/** The user's first day of the week, from their browser locale. */
export const weekStartsOn: Weekday = getLocaleWeekStart()
