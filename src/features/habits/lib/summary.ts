import {
  addDays,
  dayOfWeek,
  formatDateKey,
  type DateKey,
  type Weekday,
} from '@/lib/date'

const WEEKDAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const FULL_NAMES = [
  'Sundays',
  'Mondays',
  'Tuesdays',
  'Wednesdays',
  'Thursdays',
  'Fridays',
  'Saturdays',
]

export const everyDay = (weekdays: readonly Weekday[]) =>
  weekdays.length === 0 || weekdays.length === 7

export function isScheduled(day: DateKey, weekdays: readonly Weekday[]) {
  return everyDay(weekdays) || weekdays.includes(dayOfWeek(day))
}

/** "Every day", "Weekdays", "Tuesdays", "Mon, Wed and Fri". */
export function describeSchedule(weekdays: readonly Weekday[]): string {
  if (everyDay(weekdays)) return 'Every day'
  const days = [...weekdays].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7))
  if (days.join() === '1,2,3,4,5') return 'Weekdays'
  if (days.join() === '6,0') return 'Weekends'
  if (days.length === 1) return FULL_NAMES[days[0]]
  const names = days.map((day) => WEEKDAY_NAMES[day])
  return `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`
}

export interface HabitSummary {
  /** Scheduled days in a row, done, up to today (today counts once done). */
  current: number
  longest: number
  /** Every day it was done, scheduled or not. */
  total: number
  doneToday: boolean
  dueToday: boolean
  /** Share of scheduled days done in the last four weeks (null if none yet). */
  rate: number | null
  /** How far into a run each done day was (for the calendar). */
  depths: Map<DateKey, number>
}

/**
 * A habit's streak counts the days it's scheduled. Missing a scheduled day
 * ends the run; days off neither break nor extend it; today stays open until
 * it ends. Days before the habit existed don't count against it.
 */
export function summarizeHabit(
  done: ReadonlySet<DateKey>,
  today: DateKey,
  weekdays: readonly Weekday[],
  since: DateKey,
): HabitSummary {
  const history = [...done].filter((day) => day <= today).sort()
  const start = history[0] && history[0] < since ? history[0] : since
  const depths = new Map<DateKey, number>()
  let run = 0
  let longest = 0
  const rateFrom = addDays(today, -27)
  let scheduledRecent = 0
  let doneRecent = 0
  for (let day = start; day <= today; day = addDays(day, 1)) {
    const scheduled = isScheduled(day, weekdays)
    const isDone = done.has(day)
    if (day === today && !isDone) {
      // Still open: neither done nor missed yet.
      break
    }
    if (scheduled) {
      run = isDone ? run + 1 : 0
      longest = Math.max(longest, run)
      if (day >= rateFrom && day >= since) {
        scheduledRecent++
        if (isDone) doneRecent++
      }
    }
    if (isDone) depths.set(day, Math.max(run, 1))
  }
  return {
    current: run,
    longest,
    total: history.length,
    doneToday: done.has(today),
    dueToday: isScheduled(today, weekdays),
    rate: scheduledRecent ? doneRecent / scheduledRecent : null,
    depths,
  }
}

export type DotState = 'done' | 'missed' | 'open' | 'off'

/** The last seven days for the week dots, oldest first. */
export function lastWeek(
  done: ReadonlySet<DateKey>,
  today: DateKey,
  weekdays: readonly Weekday[],
  since: DateKey,
): { day: DateKey; label: string; state: DotState }[] {
  return Array.from({ length: 7 }, (_, index) => {
    const day = addDays(today, index - 6)
    const state: DotState = done.has(day)
      ? 'done'
      : !isScheduled(day, weekdays) || day < since
        ? 'off'
        : day === today
          ? 'open'
          : 'missed'
    return {
      day,
      label: formatDateKey(day, { weekday: 'narrow' }),
      state,
    }
  })
}

/** A run's depth on the calendar's four levels (as the main streak). */
export function depthLevel(depth: number): number {
  return depth <= 0 ? 0 : depth === 1 ? 1 : depth <= 3 ? 2 : depth <= 6 ? 3 : 4
}
