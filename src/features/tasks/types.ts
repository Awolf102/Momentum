import type { CollectionRecord } from '@/lib/collection'
import type { DateKey, Weekday } from '@/lib/date'

/** Where a task sits on the board. */
export type TaskStatus = 'todo' | 'doing' | 'done'

/** 0 none, 1 low, 2 medium, 3 high. */
export type Priority = 0 | 1 | 2 | 3

export type RecurrenceUnit = 'day' | 'week' | 'month' | 'year'

/** How a task repeats: every `interval` days, weeks, months or years. */
export interface Recurrence {
  unit: RecurrenceUnit
  interval: number
  /** Weekly only: the days it falls on. Empty means the anchor's weekday. */
  weekdays: Weekday[]
  /**
   * The date the schedule is counted from: weeks for "every 2 weeks", the day
   * of the month for monthly and yearly dates (the 31st stays the 31st where
   * a month has one).
   */
  anchor: DateKey
}

/** One task, or one occurrence of a repeating task. */
export interface Task extends CollectionRecord {
  title: string
  subjectId: string | null
  status: TaskStatus
  priority: Priority
  due: DateKey | null
  /** "HH:MM", only with a due date. */
  time: string | null
  recurrence: Recurrence | null
  /** Shared by every occurrence of a repeating task (the first one's id). */
  seriesId: string
  completedAt: string | null
  /** Position within its column on the board, lowest first. */
  order: number
}
