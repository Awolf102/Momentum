import type { CollectionRecord } from '@/lib/collection'
import type { DateKey, Weekday } from '@/lib/date'

/** What a block of time is for. */
export type BlockKind = 'task' | 'focus' | 'other'

/** Time set aside on a day of the plan. */
export interface Block extends CollectionRecord {
  day: DateKey
  /** Minutes after midnight, local time. */
  start: number
  /** After `start`, at most 24:00. */
  end: number
  kind: BlockKind
  /** What it's called: kept for a task, in case the task goes. */
  title: string
  taskId: string | null
  subjectId: string | null
}

/** When an event starts, as the calendar wrote it. */
export interface EventStart {
  /** The day, in `zone` (or this device's time when there's none). */
  date: DateKey
  /** Minutes after midnight; null for an all-day event. */
  minutes: number | null
  /** An IANA zone or `UTC`; null for "wherever you are" (floating). */
  zone: string | null
}

export type Frequency = 'daily' | 'weekly' | 'monthly' | 'yearly'

/** How an event repeats (the parts of RFC 5545's RRULE Momentum follows). */
export interface RecurrenceRule {
  frequency: Frequency
  interval: number
  /** How many times in all, or null. */
  count: number | null
  /**
   * The last time it may start: a moment (ms) for a timed event, a day for
   * an all-day one. Null when it goes on.
   */
  until: number | DateKey | null
  /** Days of the week, with an ordinal for monthly and yearly ("second Tuesday"). */
  byDay: { weekday: Weekday; ordinal: number | null }[]
  /** Days of the month (negative from the end). */
  byMonthDay: number[]
  /** Months, 1–12 (yearly). */
  byMonth: number[]
  weekStart: Weekday
}

/** One event (or a repeating series) from an imported calendar. */
export interface CalendarEvent {
  uid: string
  title: string
  location: string
  start: EventStart
  /** Minutes long for a timed event, days for an all-day one. */
  length: number
  rule: RecurrenceRule | null
  /**
   * Occurrences left out (EXDATE, and ones moved elsewhere): moments for
   * a timed event, days for an all-day one.
   */
  except: (number | DateKey)[]
}

export type CalendarColor =
  'sky' | 'violet' | 'emerald' | 'rose' | 'amber' | 'slate'

/** A calendar imported from an .ics file: read-only, replaced by importing again. */
export interface Calendar extends CollectionRecord {
  name: string
  color: CalendarColor
  hidden: boolean
  /** The file it came from. */
  fileName: string
  importedAt: string
  events: CalendarEvent[]
}
