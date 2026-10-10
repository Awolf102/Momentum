// The days a repeating event falls on, following its RRULE: every few days
// or weeks, chosen weekdays, days of the month, the nth weekday, a count or
// an end, in the event's own zone.
import {
  addDays,
  addMonths,
  dayOfMonth,
  dayOfWeek,
  daysInMonth,
  makeDateKey,
  startOfWeek,
  type DateKey,
} from '@/lib/date'
import type { CalendarEvent, RecurrenceRule } from '../types'
import { zonedMoment } from './zones'

/** Periods (days, weeks, months, years) looked through at most. */
const MAX_PERIODS = 20_000

const monthOf = (day: DateKey) => Number(day.slice(5, 7))
const yearOf = (day: DateKey) => Number(day.slice(0, 4))

/** The days of a month a monthly (or yearly) rule picks, in order. */
function daysInMonthFor(
  rule: RecurrenceRule,
  year: number,
  month: number,
  startDay: number,
): DateKey[] {
  const length = daysInMonth(year, month)
  let days: number[]
  const byMonthDay = rule.byMonthDay
    .map((day) => (day > 0 ? day : length + day + 1))
    .filter((day) => day >= 1 && day <= length)
  if (rule.byDay.length > 0) {
    const first = makeDateKey(year, month, 1)!
    const firstWeekday = dayOfWeek(first)
    days = []
    for (const { weekday, ordinal } of rule.byDay) {
      const all: number[] = []
      for (
        let day = 1 + ((weekday - firstWeekday + 7) % 7);
        day <= length;
        day += 7
      )
        all.push(day)
      if (ordinal === null) days.push(...all)
      else {
        const picked =
          ordinal > 0 ? all[ordinal - 1] : all[all.length + ordinal]
        if (picked) days.push(picked)
      }
    }
    // Both given: the weekdays that are also those days of the month.
    if (rule.byMonthDay.length > 0)
      days = days.filter((day) => byMonthDay.includes(day))
  } else if (rule.byMonthDay.length > 0) days = byMonthDay
  // The start's day, in months that have one (the 31st skips short months).
  else days = startDay <= length ? [startDay] : []
  return [...new Set(days)]
    .sort((a, b) => a - b)
    .map((day) => makeDateKey(year, month, day)!)
}

/** Candidate days in order, from the event's first day to `last` (before count and end). */
function* candidates(
  rule: RecurrenceRule,
  first: DateKey,
  last: DateKey,
): Generator<DateKey> {
  const weekdays = rule.byDay.map((day) => day.weekday)
  const inMonths = (day: DateKey) =>
    rule.byMonth.length === 0 || rule.byMonth.includes(monthOf(day))
  switch (rule.frequency) {
    case 'daily':
      for (let period = 0; period < MAX_PERIODS; period++) {
        const day = addDays(first, period * rule.interval)
        if (day > last) return
        if (
          inMonths(day) &&
          (weekdays.length === 0 || weekdays.includes(dayOfWeek(day))) &&
          (rule.byMonthDay.length === 0 ||
            rule.byMonthDay.some(
              (wanted) =>
                (wanted > 0
                  ? wanted
                  : daysInMonth(yearOf(day), monthOf(day)) + wanted + 1) ===
                dayOfMonth(day),
            ))
        )
          yield day
      }
      return
    case 'weekly': {
      const week = startOfWeek(first, rule.weekStart)
      const offsets = [
        ...new Set(
          (weekdays.length > 0 ? weekdays : [dayOfWeek(first)]).map(
            (weekday) => (weekday - rule.weekStart + 7) % 7,
          ),
        ),
      ].sort((a, b) => a - b)
      for (let period = 0; period < MAX_PERIODS; period++) {
        const base = addDays(week, period * 7 * rule.interval)
        if (base > last) return
        for (const offset of offsets) {
          const day = addDays(base, offset)
          if (day >= first && inMonths(day)) yield day
        }
      }
      return
    }
    case 'monthly':
      for (let period = 0; period < MAX_PERIODS; period++) {
        const month = addMonths(
          first.slice(0, 8) + '01',
          period * rule.interval,
        )
        if (month > last) return
        if (!inMonths(month)) continue
        for (const day of daysInMonthFor(
          rule,
          yearOf(month),
          monthOf(month),
          dayOfMonth(first),
        ))
          if (day >= first) yield day
      }
      return
    case 'yearly':
      for (let period = 0; period < MAX_PERIODS; period++) {
        const year = yearOf(first) + period * rule.interval
        if (year > yearOf(last)) return
        const months =
          rule.byMonth.length > 0
            ? [...rule.byMonth].sort((a, b) => a - b)
            : [monthOf(first)]
        for (const month of months)
          for (const day of daysInMonthFor(
            rule,
            year,
            month,
            dayOfMonth(first),
          ))
            if (day >= first) yield day
      }
  }
}

/**
 * The days an event starts on, in its own zone, up to `last`: its first day
 * alone if it doesn't repeat. Times left out (EXDATE) are still counted
 * towards a COUNT, as the standard says, and are filtered by the caller.
 */
export function* occurrenceDays(
  event: CalendarEvent,
  last: DateKey,
): Generator<DateKey> {
  const { start, rule } = event
  if (!rule) {
    if (start.date <= last) yield start.date
    return
  }
  let made = 0
  for (const day of candidates(rule, start.date, last)) {
    if (day > last) return
    if (rule.count !== null && made >= rule.count) return
    if (rule.until !== null) {
      const past =
        typeof rule.until === 'number'
          ? zonedMoment(day, start.minutes ?? 0, start.zone) > rule.until
          : day > rule.until
      if (past) return
    }
    made++
    yield day
  }
}
