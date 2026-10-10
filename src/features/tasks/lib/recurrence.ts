import {
  addDays,
  addMonths,
  dayOfMonth,
  dayOfWeek,
  daysBetween,
  monthsBetween,
  startOfWeek,
  type DateKey,
  type Weekday,
} from '@/lib/date'
import type { Recurrence } from '../types'

const WEEKDAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const WORKDAYS: readonly Weekday[] = [1, 2, 3, 4, 5]

/** Whether `day` is one of the schedule's dates (on or after its anchor). */
function isScheduled(day: DateKey, rule: Recurrence): boolean {
  if (day < rule.anchor) return false
  switch (rule.unit) {
    case 'day':
      return daysBetween(rule.anchor, day) % rule.interval === 0
    case 'week': {
      const weekdays = rule.weekdays.length
        ? rule.weekdays
        : [dayOfWeek(rule.anchor)]
      if (!weekdays.includes(dayOfWeek(day))) return false
      // Weeks counted Monday to Sunday from the anchor's week.
      const weeks =
        daysBetween(startOfWeek(rule.anchor, 1), startOfWeek(day, 1)) / 7
      return weeks % rule.interval === 0
    }
    case 'month':
    case 'year': {
      const step = rule.unit === 'month' ? rule.interval : rule.interval * 12
      const months = monthsBetween(rule.anchor, day)
      return (
        months % step === 0 &&
        day === addMonths(rule.anchor, months, dayOfMonth(rule.anchor))
      )
    }
  }
}

/** The first scheduled date after `from` (never `from` itself). */
export function stepAfter(from: DateKey, rule: Recurrence): DateKey {
  if (from < rule.anchor) return rule.anchor
  switch (rule.unit) {
    case 'day': {
      const passed = daysBetween(rule.anchor, from)
      return addDays(
        rule.anchor,
        (Math.floor(passed / rule.interval) + 1) * rule.interval,
      )
    }
    case 'week': {
      // At most `interval` weeks plus one to look through.
      for (let offset = 1; offset <= 7 * (rule.interval + 1); offset++) {
        const day = addDays(from, offset)
        if (isScheduled(day, rule)) return day
      }
      return addDays(from, 7 * rule.interval)
    }
    case 'month':
    case 'year': {
      const step = rule.unit === 'month' ? rule.interval : rule.interval * 12
      const months = monthsBetween(rule.anchor, from)
      let k = Math.max(0, Math.floor(months / step))
      let day = addMonths(rule.anchor, k * step, dayOfMonth(rule.anchor))
      while (day <= from) {
        k++
        day = addMonths(rule.anchor, k * step, dayOfMonth(rule.anchor))
      }
      return day
    }
  }
}

/** The first scheduled date on or after `day` (a new repeating task's due date). */
export function firstOnOrAfter(day: DateKey, rule: Recurrence): DateKey {
  return isScheduled(day, rule) ? day : stepAfter(day, rule)
}

/**
 * When the next occurrence is due, after finishing one due on `due`. Missed
 * occurrences are skipped, so it's always after today: water the plants a day
 * late and they're next due tomorrow, not yesterday.
 */
export function nextDue(
  due: DateKey,
  rule: Recurrence,
  today: DateKey,
): DateKey {
  let next = stepAfter(due, rule)
  // Bounded: a daily rule a long way behind jumps straight to today.
  if (next <= today && rule.unit === 'day')
    next = stepAfter(addDays(today, -1), rule)
  while (next <= today) next = stepAfter(next, rule)
  return next
}

const ORDINAL = new Intl.PluralRules('en', { type: 'ordinal' })
const SUFFIX: Record<string, string> = {
  one: 'st',
  two: 'nd',
  few: 'rd',
  other: 'th',
}
const ordinal = (n: number) => `${n}${SUFFIX[ORDINAL.select(n)]}`

function joinWords(words: string[]): string {
  return words.length <= 1
    ? words.join('')
    : `${words.slice(0, -1).join(', ')} and ${words.at(-1)}`
}

/** "Every day", "Every 2 weeks", "Every Mon and Thu", "Every month on the 31st". */
export function describeRecurrence(rule: Recurrence): string {
  const every = (unit: string) =>
    rule.interval === 1 ? `Every ${unit}` : `Every ${rule.interval} ${unit}s`
  switch (rule.unit) {
    case 'day':
      return every('day')
    case 'week': {
      const days = [...rule.weekdays].sort()
      if (days.length === 0) return every('week')
      const sameAs = (set: readonly Weekday[]) =>
        days.length === set.length && set.every((day) => days.includes(day))
      const label = sameAs(WORKDAYS)
        ? 'weekday'
        : sameAs([0, 6])
          ? 'weekend'
          : null
      const names = joinWords(
        // Monday first.
        [...days]
          .sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7))
          .map((day) => WEEKDAY_NAMES[day]),
      )
      if (rule.interval === 1) return `Every ${label ?? names}`
      return `Every ${rule.interval} weeks on ${label ? `${label}s` : names}`
    }
    case 'month':
      return `${every('month')} on the ${ordinal(dayOfMonth(rule.anchor))}`
    case 'year':
      return every('year')
  }
}
