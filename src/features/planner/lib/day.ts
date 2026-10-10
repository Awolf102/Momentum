import { addDays, type DateKey } from '@/lib/date'
import type { Calendar, CalendarColor } from '../types'
import { occurrenceDays } from './recurrence'
import { DAY_MINUTES } from './time'
import { zonedMoment } from './zones'

/** One time an imported event happens, on a day of the plan. */
export interface EventOnDay {
  /** Unique on the day. */
  key: string
  calendarId: string
  color: CalendarColor
  title: string
  location: string
  allDay: boolean
  /** Minutes after midnight on this day: 0 when it began before, 24:00 when it runs past. */
  start: number
  end: number
  /** It began on an earlier day. */
  fromBefore: boolean
  /** It goes on past midnight. */
  pastEnd: boolean
}

/** A moment's wall-clock minutes on a local day, clipped to the day. */
function minutesOn(moment: number, dayStart: number, dayEnd: number): number {
  if (moment <= dayStart) return 0
  if (moment >= dayEnd) return DAY_MINUTES
  const date = new Date(moment)
  return date.getHours() * 60 + date.getMinutes()
}

/**
 * What the shown calendars have on a day, in this device's time: repeats
 * expanded, times left out skipped, events from the night before or running
 * past midnight cut to the day.
 */
export function eventsOnDay(
  calendars: readonly Calendar[],
  day: DateKey,
): EventOnDay[] {
  const dayStart = zonedMoment(day, 0, null)
  const dayEnd = zonedMoment(addDays(day, 1), 0, null)
  const found: EventOnDay[] = []
  for (const calendar of calendars) {
    if (calendar.hidden) continue
    calendar.events.forEach((event, index) => {
      const except = new Set<number | string>(event.except)
      const base = {
        calendarId: calendar.id,
        color: calendar.color,
        title: event.title,
        location: event.location,
      }
      if (event.start.minutes === null) {
        // All day: the same days wherever you are.
        const earliest = addDays(day, -(event.length - 1))
        for (const first of occurrenceDays(event, day)) {
          if (first < earliest || except.has(first)) continue
          const last = addDays(first, event.length - 1)
          found.push({
            ...base,
            key: `${calendar.id}:${index}:${first}`,
            allDay: true,
            start: 0,
            end: DAY_MINUTES,
            fromBefore: first < day,
            pastEnd: last > day,
          })
        }
        return
      }
      // Its own day can differ from yours by one either way.
      const earliest = addDays(
        day,
        -(Math.ceil(event.length / DAY_MINUTES) + 1),
      )
      if (!event.rule && event.start.date < earliest) return
      for (const first of occurrenceDays(event, addDays(day, 1))) {
        if (first < earliest) continue
        const start = zonedMoment(first, event.start.minutes, event.start.zone)
        if (except.has(start)) continue
        const end = start + event.length * 60_000
        const overlaps =
          event.length === 0
            ? start >= dayStart && start < dayEnd
            : start < dayEnd && end > dayStart
        if (!overlaps) continue
        found.push({
          ...base,
          key: `${calendar.id}:${index}:${start}`,
          allDay: false,
          start: minutesOn(start, dayStart, dayEnd),
          end: minutesOn(end, dayStart, dayEnd),
          fromBefore: start < dayStart,
          pastEnd: end > dayEnd,
        })
      }
    })
  }
  return found.sort((a, b) => a.start - b.start || a.end - b.end)
}
