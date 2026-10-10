import { createCollection } from '@/lib/collection'
import { isDateKey, type Weekday } from '@/lib/date'
import { isRecord } from '@/lib/guards'
import { MAX_EVENTS, MAX_TEXT } from './lib/limits'
import type {
  Calendar,
  CalendarColor,
  CalendarEvent,
  EventStart,
  Frequency,
  RecurrenceRule,
} from './types'

export const CALENDAR_COLORS: readonly CalendarColor[] = [
  'sky',
  'violet',
  'emerald',
  'rose',
  'amber',
  'slate',
]
const FREQUENCIES: readonly Frequency[] = [
  'daily',
  'weekly',
  'monthly',
  'yearly',
]
export const MAX_CALENDAR_NAME = 80

const text = (value: unknown, max = MAX_TEXT) =>
  typeof value === 'string' ? value.slice(0, max) : ''
const isWeekday = (value: unknown): value is Weekday =>
  Number.isInteger(value) && (value as number) >= 0 && (value as number) <= 6
const isZone = (value: unknown): value is string | null =>
  value === null || (typeof value === 'string' && value.length <= 64)

function parseStart(value: unknown): EventStart | null {
  if (!isRecord(value) || !isDateKey(value.date) || !isZone(value.zone))
    return null
  const { minutes } = value
  if (
    minutes !== null &&
    !(
      Number.isInteger(minutes) &&
      (minutes as number) >= 0 &&
      (minutes as number) < 1440
    )
  )
    return null
  return {
    date: value.date,
    minutes: minutes as number | null,
    zone: value.zone,
  }
}

const integers = (value: unknown, min: number, max: number) =>
  Array.isArray(value)
    ? value.filter(
        (each): each is number =>
          Number.isInteger(each) &&
          each !== 0 &&
          Math.abs(each) >= min &&
          Math.abs(each) <= max,
      )
    : []

function parseRule(value: unknown): RecurrenceRule | null {
  if (!isRecord(value)) return null
  const frequency = value.frequency as Frequency
  if (!FREQUENCIES.includes(frequency)) return null
  const interval = Number.isInteger(value.interval)
    ? (value.interval as number)
    : 1
  const count = Number.isInteger(value.count) ? (value.count as number) : null
  const { until } = value
  return {
    frequency,
    interval: Math.max(1, interval),
    count: count !== null && count > 0 ? count : null,
    until:
      (typeof until === 'number' && Number.isFinite(until)) || isDateKey(until)
        ? (until as number | string)
        : null,
    byDay: Array.isArray(value.byDay)
      ? value.byDay.flatMap((day) =>
          isRecord(day) && isWeekday(day.weekday)
            ? [
                {
                  weekday: day.weekday,
                  ordinal:
                    Number.isInteger(day.ordinal) &&
                    day.ordinal !== 0 &&
                    Math.abs(day.ordinal as number) <= 53
                      ? (day.ordinal as number)
                      : null,
                },
              ]
            : [],
        )
      : [],
    byMonthDay: integers(value.byMonthDay, 1, 31),
    byMonth: integers(value.byMonth, 1, 12).filter((month) => month > 0),
    weekStart: isWeekday(value.weekStart) ? value.weekStart : 1,
  }
}

function parseEvent(value: unknown): CalendarEvent | null {
  if (!isRecord(value)) return null
  const start = parseStart(value.start)
  const { length } = value
  if (!start || !Number.isInteger(length) || (length as number) < 0) return null
  return {
    uid: text(value.uid, 300),
    title: text(value.title),
    location: text(value.location),
    start,
    length:
      start.minutes === null
        ? Math.max(1, length as number)
        : (length as number),
    rule: value.rule === null ? null : parseRule(value.rule),
    except: Array.isArray(value.except)
      ? value.except.filter(
          (each): each is number | string =>
            (typeof each === 'number' && Number.isFinite(each)) ||
            isDateKey(each),
        )
      : [],
  }
}

/** A calendar read back from storage or a backup. */
export function parseCalendar(value: unknown): Calendar | null {
  if (!isRecord(value)) return null
  const { id, createdAt, updatedAt } = value
  if (
    typeof id !== 'string' ||
    typeof createdAt !== 'string' ||
    typeof updatedAt !== 'string' ||
    !Array.isArray(value.events)
  )
    return null
  return {
    id,
    name: text(value.name, MAX_CALENDAR_NAME).trim() || 'Calendar',
    color: CALENDAR_COLORS.includes(value.color as CalendarColor)
      ? (value.color as CalendarColor)
      : 'sky',
    hidden: value.hidden === true,
    fileName: text(value.fileName),
    importedAt:
      typeof value.importedAt === 'string' ? value.importedAt : updatedAt,
    events: value.events
      .slice(0, MAX_EVENTS)
      .map(parseEvent)
      .filter((event): event is CalendarEvent => event !== null),
    createdAt,
    updatedAt,
    deletedAt: typeof value.deletedAt === 'string' ? value.deletedAt : null,
  }
}

/** Calendars imported from .ics files, each with its events. */
export const calendars = createCollection<Calendar>({
  name: 'calendars',
  parse: parseCalendar,
})
