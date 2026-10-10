import type { SubjectColor } from '@/features/subjects'
import type { CollectionRecord } from '@/lib/collection'
import type { DateKey, Weekday } from '@/lib/date'

/** Something to do regularly, with its own streak. */
export interface Habit {
  id: string
  name: string
  color: SubjectColor
  /** The days it's due. Empty means every day. */
  weekdays: Weekday[]
  /** Position on the dashboard. */
  order: number
  createdAt: string
  updatedAt: string
  deletedAt: string | null
}

/** A habit done on a day. The id is "<habitId>:<day>": once per day. */
export interface HabitCheckIn extends CollectionRecord {
  habitId: string
  day: DateKey
}
