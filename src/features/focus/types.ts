import type { CollectionRecord } from '@/lib/collection'
import type { DateKey } from '@/lib/date'

export type PhaseKind = 'focus' | 'short-break' | 'long-break'

/**
 * The phase on the clock. Only timestamps are stored, never a countdown, so
 * the time left is always worked out from the clock: it stays right while the
 * tab sleeps, and a reload picks up exactly where it was.
 */
export interface ActivePhase {
  id: string
  kind: PhaseKind
  /** What a focus session is about (`null` for breaks or no subject). */
  subjectId: string | null
  /** When the phase first started (epoch ms). */
  startedAt: number
  /** How long it runs, fixed when it starts. */
  durationMs: number
  /** When it was paused, or `null` while running. */
  pausedAt: number | null
  /** Total time spent paused before `pausedAt`. */
  pausedMs: number
}

export interface TimerState {
  phase: ActivePhase | null
  /** Focus sessions finished since the last long break. */
  completedInCycle: number
  /** The last day a finished session was considered for an auto check-in. */
  lastAutoCheckIn: DateKey | null
}

export interface FocusSettings {
  focusMinutes: number
  shortBreakMinutes: number
  longBreakMinutes: number
  /** Play the ambient mix while focusing and pause it on breaks. */
  autoAmbience: boolean
  /** The subject chosen for the next session. */
  subjectId: string | null
}

export interface Durations {
  focusMs: number
  shortBreakMs: number
  longBreakMs: number
}

/** One finished focus session. Cancelled sessions are never stored. */
export interface FocusSession extends CollectionRecord {
  subjectId: string | null
  /** ISO times; the session may have been paused in between. */
  startedAt: string
  endedAt: string
  /** Time spent focusing (the planned length; pauses excluded). */
  durationMs: number
  pausedMs: number
  /** The day it counts toward: the local day it started. */
  day: DateKey
}
