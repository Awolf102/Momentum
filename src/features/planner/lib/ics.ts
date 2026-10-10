// Reading iCalendar (.ics) files: the events, how they repeat, and the
// times they were moved or cancelled. RFC 5545, as far as calendars that
// students import (timetables, Google, Outlook, Apple) use it.
import {
  addDays,
  daysBetween,
  makeDateKey,
  type DateKey,
  type Weekday,
} from '@/lib/date'
import type {
  CalendarEvent,
  EventStart,
  Frequency,
  RecurrenceRule,
} from '../types'
import { MAX_EVENTS, MAX_TEXT } from './limits'
import { resolveZone, zonedMoment } from './zones'

export class IcsError extends Error {}

export interface Property {
  name: string
  params: Record<string, string>
  value: string
}

/** Joins folded lines: a line starting with a space or tab continues the one before. */
export function unfold(text: string): string[] {
  return text
    .replace(/\r\n?/g, '\n')
    .replace(/\n[ \t]/g, '')
    .split('\n')
    .filter((line) => line.trim() !== '')
}

/** Splits on a character outside double quotes. */
function splitOutsideQuotes(text: string, separator: string): string[] {
  const parts: string[] = []
  let current = ''
  let quoted = false
  for (const char of text) {
    if (char === '"') quoted = !quoted
    if (char === separator && !quoted) {
      parts.push(current)
      current = ''
    } else current += char
  }
  parts.push(current)
  return parts
}

/** `NAME;PARAM=VALUE:value`, with quoted parameters that may hold `:` or `;`. */
export function parseLine(line: string): Property | null {
  let quoted = false
  let colon = -1
  for (let index = 0; index < line.length; index++) {
    const char = line[index]
    if (char === '"') quoted = !quoted
    else if (char === ':' && !quoted) {
      colon = index
      break
    }
  }
  if (colon <= 0) return null
  const [name, ...rest] = splitOutsideQuotes(line.slice(0, colon), ';')
  const params: Record<string, string> = {}
  for (const param of rest) {
    const equals = param.indexOf('=')
    if (equals > 0)
      params[param.slice(0, equals).trim().toUpperCase()] = param
        .slice(equals + 1)
        .replace(/^"|"$/g, '')
  }
  return {
    name: name.trim().toUpperCase(),
    params,
    value: line.slice(colon + 1),
  }
}

/** TEXT values: `\n` is a new line, `\,` `\;` `\\` the characters themselves. */
export function unescapeText(value: string): string {
  return value.replace(/\\([nN,;\\])/g, (_, char: string) =>
    char === 'n' || char === 'N' ? '\n' : char,
  )
}

const tidy = (value: string) =>
  unescapeText(value).replace(/\s+/g, ' ').trim().slice(0, MAX_TEXT)

/** A DATE (all day) or DATE-TIME value, with the zone its TZID names. */
export function parseDateValue(
  value: string,
  params: Record<string, string> = {},
): EventStart | null {
  const text = value.trim()
  const day = /^(\d{4})(\d{2})(\d{2})$/.exec(text)
  if (day) {
    const date = makeDateKey(Number(day[1]), Number(day[2]), Number(day[3]))
    return date ? { date, minutes: null, zone: null } : null
  }
  const time = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})?(Z)?$/i.exec(text)
  if (!time) return null
  const date = makeDateKey(Number(time[1]), Number(time[2]), Number(time[3]))
  const hours = Number(time[4])
  const minutes = Number(time[5])
  if (!date || hours > 23 || minutes > 59) return null
  return {
    date,
    minutes: hours * 60 + minutes,
    zone: time[7] ? 'UTC' : resolveZone(params.TZID),
  }
}

/** A DURATION in minutes (`PT1H30M` is 90), or null if it isn't one. */
export function parseDuration(value: string): number | null {
  const match =
    /^([+-])?P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/i.exec(
      value.trim(),
    )
  if (!match || value.trim().toUpperCase().endsWith('T')) return null
  const [, sign, weeks, days, hours, minutes, seconds] = match
  if (!weeks && !days && !hours && !minutes && !seconds) return null
  const total =
    Number(weeks ?? 0) * 7 * 1440 +
    Number(days ?? 0) * 1440 +
    Number(hours ?? 0) * 60 +
    Number(minutes ?? 0) +
    Math.floor(Number(seconds ?? 0) / 60)
  return sign === '-' ? -total : total
}

/** The moment a start happens (a timed one; all-day ones start at local midnight). */
export function startMoment(start: EventStart): number {
  return zonedMoment(start.date, start.minutes ?? 0, start.zone)
}

const WEEKDAYS: Record<string, Weekday> = {
  SU: 0,
  MO: 1,
  TU: 2,
  WE: 3,
  TH: 4,
  FR: 5,
  SA: 6,
}

const FREQUENCIES: Record<string, Frequency> = {
  DAILY: 'daily',
  WEEKLY: 'weekly',
  MONTHLY: 'monthly',
  YEARLY: 'yearly',
}

/** Rule parts that change which times are chosen, beyond what's followed here. */
const UNFOLLOWED = [
  'BYSETPOS',
  'BYWEEKNO',
  'BYYEARDAY',
  'BYHOUR',
  'BYMINUTE',
  'BYSECOND',
]

const integers = (value: string | undefined, min: number, max: number) =>
  (value ?? '')
    .split(',')
    .filter(Boolean)
    .map(Number)
    .filter(
      (number) =>
        Number.isInteger(number) &&
        number !== 0 &&
        Math.abs(number) >= min &&
        Math.abs(number) <= max,
    )

/**
 * An RRULE, for an event starting at `start`. `unsupported` when it
 * repeats in a way not followed here (every few hours, the last weekday of
 * the month…): the event is then shown once.
 */
export function parseRule(
  value: string,
  start: EventStart,
): RecurrenceRule | 'unsupported' | null {
  const parts: Record<string, string> = {}
  for (const part of value.split(';')) {
    const equals = part.indexOf('=')
    if (equals > 0)
      parts[part.slice(0, equals).trim().toUpperCase()] = part
        .slice(equals + 1)
        .trim()
        .toUpperCase()
  }
  if (!parts.FREQ) return null
  const frequency = FREQUENCIES[parts.FREQ]
  if (!frequency || UNFOLLOWED.some((name) => name in parts))
    return 'unsupported'
  const interval = parts.INTERVAL ? Number(parts.INTERVAL) : 1
  if (!Number.isInteger(interval) || interval < 1) return null
  const count = parts.COUNT ? Number(parts.COUNT) : null
  if (count !== null && (!Number.isInteger(count) || count < 1)) return null

  let until: number | DateKey | null = null
  if (parts.UNTIL) {
    const end = parseDateValue(parts.UNTIL)
    if (!end) return null
    if (start.minutes === null) until = end.date
    else if (end.minutes === null)
      // A day as the limit for timed events: anything starting that day.
      until = zonedMoment(addDays(end.date, 1), 0, start.zone) - 1
    else
      until = zonedMoment(
        end.date,
        end.minutes,
        end.zone === 'UTC' ? 'UTC' : start.zone,
      )
  }

  const byDay: RecurrenceRule['byDay'] = []
  for (const entry of (parts.BYDAY ?? '').split(',').filter(Boolean)) {
    const match = /^([+-]?\d{1,2})?(SU|MO|TU|WE|TH|FR|SA)$/.exec(entry)
    if (!match) return null
    const ordinal = match[1] ? Number(match[1]) : null
    if (ordinal !== null && (ordinal === 0 || Math.abs(ordinal) > 53))
      return null
    byDay.push({
      weekday: WEEKDAYS[match[2]],
      // A weekly rule has no "second Tuesday".
      ordinal: frequency === 'weekly' || frequency === 'daily' ? null : ordinal,
    })
  }
  const byMonth = integers(parts.BYMONTH, 1, 12).filter((month) => month > 0)
  // "The 20th Monday of the year" needs months to count within.
  if (
    frequency === 'yearly' &&
    byMonth.length === 0 &&
    byDay.some((day) => day.ordinal !== null)
  )
    return 'unsupported'
  return {
    frequency,
    interval,
    count,
    until,
    byDay,
    byMonthDay: integers(parts.BYMONTHDAY, 1, 31),
    byMonth,
    weekStart: WEEKDAYS[parts.WKST] ?? 1,
  }
}

interface RawEvent {
  uid: string
  title: string
  location: string
  start: EventStart | null
  end: EventStart | null
  duration: number | null
  rule: string | null
  exceptions: EventStart[]
  recurrenceId: EventStart | null
  cancelled: boolean
}

export interface ParsedCalendar {
  /** The calendar's own name (X-WR-CALNAME), if it has one. */
  name: string | null
  events: CalendarEvent[]
  /** Events that repeat. */
  repeating: number
  /** Repeating events shown once: they repeat in a way not followed here. */
  unsupported: number
  /** Cancelled events, left out. */
  cancelled: number
  /** Events left out: without a time to put them at, or past the limit. */
  skipped: number
}

/** The length of an event: minutes when timed, days when all day. */
function lengthOf(event: RawEvent, start: EventStart): number {
  if (start.minutes === null) {
    if (event.end) return Math.max(1, daysBetween(start.date, event.end.date))
    if (event.duration !== null)
      return Math.max(1, Math.ceil(event.duration / 1440))
    return 1
  }
  if (event.end) {
    const end = { ...event.end, minutes: event.end.minutes ?? 0 }
    return Math.max(
      0,
      Math.round((startMoment(end) - startMoment(start)) / 60_000),
    )
  }
  return Math.max(0, event.duration ?? 0)
}

/** Where an occurrence is: its moment when timed, its day when all day. */
function occurrenceKey(value: EventStart, start: EventStart): number | DateKey {
  if (start.minutes === null) return value.date
  return startMoment(
    value.minutes === null
      ? { date: value.date, minutes: start.minutes, zone: start.zone }
      : value,
  )
}

/**
 * Reads an .ics file's events. Times keep the zone they were written in, so
 * a class at 9:00 stays at 9:00 through daylight-saving changes.
 */
export function parseIcs(text: string): ParsedCalendar {
  const lines = unfold(text)
  if (!lines.some((line) => /^BEGIN:VCALENDAR\s*$/i.test(line)))
    throw new IcsError('That isn’t a calendar file (.ics).')

  const raw: RawEvent[] = []
  const stack: string[] = []
  let name: string | null = null
  let event: RawEvent | null = null
  for (const line of lines) {
    const property = parseLine(line)
    if (!property) continue
    if (property.name === 'BEGIN') {
      const component = property.value.trim().toUpperCase()
      stack.push(component)
      if (component === 'VEVENT' && stack.length === 2)
        event = {
          uid: '',
          title: '',
          location: '',
          start: null,
          end: null,
          duration: null,
          rule: null,
          exceptions: [],
          recurrenceId: null,
          cancelled: false,
        }
      continue
    }
    if (property.name === 'END') {
      const component = stack.pop()
      if (component === 'VEVENT' && event) {
        raw.push(event)
        event = null
      }
      continue
    }
    const where = stack.at(-1)
    if (where === 'VCALENDAR' && property.name === 'X-WR-CALNAME')
      name = tidy(property.value) || null
    // Only the event's own lines: not its alarms'.
    if (where !== 'VEVENT' || !event) continue
    const { params, value } = property
    switch (property.name) {
      case 'UID':
        event.uid = value.trim().slice(0, 300)
        break
      case 'SUMMARY':
        event.title = tidy(value)
        break
      case 'LOCATION':
        event.location = tidy(value)
        break
      case 'DTSTART':
        event.start = parseDateValue(value, params)
        break
      case 'DTEND':
        event.end = parseDateValue(value, params)
        break
      case 'DURATION':
        event.duration = parseDuration(value)
        break
      case 'RRULE':
        event.rule = value
        break
      case 'EXDATE':
        for (const each of value.split(','))
          if (each.trim()) {
            const parsed = parseDateValue(each, params)
            if (parsed) event.exceptions.push(parsed)
          }
        break
      case 'RECURRENCE-ID':
        event.recurrenceId = parseDateValue(value, params)
        break
      case 'STATUS':
        event.cancelled = value.trim().toUpperCase() === 'CANCELLED'
        break
    }
  }

  const pending: {
    event: CalendarEvent
    recurrenceId: EventStart | null
    cancelled: boolean
  }[] = []
  let skipped = 0
  let unsupported = 0
  for (const each of raw) {
    const start = each.start
    if (!start) {
      skipped++
      continue
    }
    let rule: RecurrenceRule | null = null
    if (each.rule && !each.recurrenceId) {
      const parsed = parseRule(each.rule, start)
      if (parsed === 'unsupported') unsupported++
      else rule = parsed
    }
    pending.push({
      event: {
        uid: each.uid,
        title: each.title,
        location: each.location,
        start,
        length: lengthOf(each, start),
        rule,
        except: each.exceptions.map((value) => occurrenceKey(value, start)),
      },
      recurrenceId: each.recurrenceId,
      cancelled: each.cancelled,
    })
  }

  // A changed or cancelled occurrence of a series comes as an event of its
  // own: the series leaves that time out, and the change stands alone.
  const series = new Map<string, CalendarEvent>()
  for (const { event, recurrenceId } of pending)
    if (!recurrenceId && event.rule && event.uid) series.set(event.uid, event)
  const events: CalendarEvent[] = []
  let cancelled = 0
  for (const { event, recurrenceId, cancelled: isCancelled } of pending) {
    if (recurrenceId) {
      const parent = series.get(event.uid)
      if (parent) parent.except.push(occurrenceKey(recurrenceId, parent.start))
    }
    if (isCancelled) cancelled++
    else if (events.length >= MAX_EVENTS) skipped++
    else events.push(event)
  }
  return {
    name,
    events,
    repeating: events.filter((each) => each.rule).length,
    unsupported,
    cancelled,
    skipped,
  }
}
