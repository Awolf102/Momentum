import type { DateKey } from '@/lib/date'
import { shouldAutoCheckIn } from './lib/autoCheckIn'
import { advance, sessionFor } from './lib/timer'
import type { ActivePhase, Durations, FocusSession, TimerState } from './types'

export interface EngineDeps {
  timer: {
    get(): TimerState
    set(next: TimerState | ((previous: TimerState) => TimerState)): void
  }
  durations(): Durations
  /** Saves a finished session. False if it was already saved (by another tab). */
  record(session: FocusSession): Promise<boolean>
  /** The streak's own check-in. False if that day was already checked in. */
  checkIn(at: Date, day: DateKey): boolean
}

export interface Completion {
  phase: ActivePhase
  endedAt: number
  /** The saved session, for focus phases. */
  session?: FocusSession
  /** False when another tab got to this session first (it announces it). */
  recorded: boolean
  /** Whether finishing this session checked its day in. */
  checkedIn: boolean
}

/**
 * Brings the timer up to `now`: ends every phase whose time is up (at its
 * scheduled time, even if the app was closed then), saves finished focus
 * sessions, and checks in the first one of each day.
 */
export async function settle(
  deps: EngineDeps,
  now: number,
): Promise<Completion[]> {
  const { state, ended } = advance(deps.timer.get(), deps.durations(), now)
  if (ended.length === 0) return []
  // Saved before anything else, so a second settle at the same moment (a
  // timer and a wake-up together) finds nothing left to do.
  deps.timer.set(state)

  const completions: Completion[] = []
  for (const { phase, endedAt } of ended) {
    if (phase.kind !== 'focus') {
      completions.push({ phase, endedAt, recorded: true, checkedIn: false })
      continue
    }
    const session = sessionFor(phase, endedAt)
    const recorded = await deps.record(session)
    let checkedIn = false
    if (
      recorded &&
      shouldAutoCheckIn(session.day, deps.timer.get().lastAutoCheckIn)
    ) {
      deps.timer.set((previous) => ({
        ...previous,
        lastAutoCheckIn: session.day,
      }))
      checkedIn = deps.checkIn(new Date(endedAt), session.day)
    }
    completions.push({ phase, endedAt, session, recorded, checkedIn })
  }
  return completions
}
