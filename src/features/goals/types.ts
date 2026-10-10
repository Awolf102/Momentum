import type { CollectionRecord } from '@/lib/collection'
import type { DateKey } from '@/lib/date'

/** A step on the way to a goal. */
export interface Milestone {
  id: string
  title: string
  /** The day it should be done by, if it has one. */
  due: DateKey | null
  /** When it was done, or null. */
  doneAt: string | null
}

/** Being worked on, reached, or put away without being reached. */
export type GoalStatus = 'active' | 'achieved' | 'archived'

/** Something long-term, with milestones, tasks and habits towards it. */
export interface Goal extends CollectionRecord {
  title: string
  /** Why it matters, in your own words. */
  why: string
  subjectId: string | null
  /** The day to reach it by, if there is one. */
  target: DateKey | null
  milestones: Milestone[]
  /** Tasks that are steps towards it. */
  taskIds: string[]
  /** Habits that build towards it. */
  habitIds: string[]
  status: GoalStatus
  /** When it was reached or put away. */
  closedAt: string | null
  /** Position among the active goals, lowest first. */
  order: number
}
