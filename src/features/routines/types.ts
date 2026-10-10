import type { CollectionRecord } from '@/lib/collection'
import type { DateKey, Weekday } from '@/lib/date'

/** When in the day a routine belongs. */
export type PartOfDay = 'morning' | 'afternoon' | 'evening' | 'anytime'

export interface RoutineStep {
  id: string
  text: string
}

/** A checklist for a part of the day, done afresh each day. */
export interface Routine {
  id: string
  name: string
  part: PartOfDay
  steps: RoutineStep[]
  /** The days it's due. Empty means every day. */
  weekdays: Weekday[]
  order: number
  createdAt: string
  updatedAt: string
  deletedAt: string | null
}

/** One day's run through a routine: which steps are done. */
export interface RoutineRun extends CollectionRecord {
  routineId: string
  day: DateKey
  /** Step ids, in the order they were ticked. */
  done: string[]
  /** When the last step was ticked (cleared if one is unticked). */
  completedAt: string | null
}
