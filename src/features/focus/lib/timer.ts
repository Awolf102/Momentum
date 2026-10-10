import { toDateKey } from '@/lib/date'
import type {
  ActivePhase,
  Durations,
  FocusSession,
  PhaseKind,
  TimerState,
} from '../types'

/** A long break comes after this many focus sessions. */
export const SESSIONS_BEFORE_LONG_BREAK = 4

export const IDLE: TimerState = {
  phase: null,
  completedInCycle: 0,
  lastAutoCheckIn: null,
}

const MINUTE = 60_000

export function durationsFrom(settings: {
  focusMinutes: number
  shortBreakMinutes: number
  longBreakMinutes: number
}): Durations {
  return {
    focusMs: settings.focusMinutes * MINUTE,
    shortBreakMs: settings.shortBreakMinutes * MINUTE,
    longBreakMs: settings.longBreakMinutes * MINUTE,
  }
}

/** Time spent in the phase so far, not counting pauses. */
export function elapsedMs(phase: ActivePhase, now: number): number {
  const until = phase.pausedAt ?? now
  return Math.min(
    phase.durationMs,
    Math.max(0, until - phase.startedAt - phase.pausedMs),
  )
}

export function remainingMs(phase: ActivePhase, now: number): number {
  return phase.durationMs - elapsedMs(phase, now)
}

/** 0 → 1 through the phase. */
export function progress(phase: ActivePhase, now: number): number {
  return phase.durationMs > 0 ? elapsedMs(phase, now) / phase.durationMs : 1
}

/** When a running phase is due to end (epoch ms), or `null` while paused. */
export function scheduledEnd(phase: ActivePhase): number | null {
  return phase.pausedAt === null
    ? phase.startedAt + phase.pausedMs + phase.durationMs
    : null
}

export const isPaused = (phase: ActivePhase) => phase.pausedAt !== null
export const isBreak = (kind: PhaseKind) => kind !== 'focus'

function hasEnded(phase: ActivePhase, now: number): boolean {
  const end = scheduledEnd(phase)
  return end !== null && now >= end
}

function newPhase(
  id: string,
  kind: PhaseKind,
  subjectId: string | null,
  startedAt: number,
  durations: Durations,
): ActivePhase {
  const durationMs =
    kind === 'focus'
      ? durations.focusMs
      : kind === 'long-break'
        ? durations.longBreakMs
        : durations.shortBreakMs
  return {
    id,
    kind,
    subjectId,
    startedAt,
    durationMs,
    pausedAt: null,
    pausedMs: 0,
  }
}

/** Starts a focus session (only when nothing is on the clock). */
export function start(
  state: TimerState,
  options: {
    id: string
    subjectId: string | null
    now: number
    durations: Durations
  },
): TimerState {
  if (state.phase) return state
  return {
    ...state,
    phase: newPhase(
      options.id,
      'focus',
      options.subjectId,
      options.now,
      options.durations,
    ),
  }
}

/** Pauses a running phase. A phase whose time is up is left to finish. */
export function pause(state: TimerState, now: number): TimerState {
  const { phase } = state
  if (!phase || isPaused(phase) || hasEnded(phase, now)) return state
  return { ...state, phase: { ...phase, pausedAt: now } }
}

export function resume(state: TimerState, now: number): TimerState {
  const { phase } = state
  if (!phase || phase.pausedAt === null) return state
  return {
    ...state,
    phase: {
      ...phase,
      pausedAt: null,
      pausedMs: phase.pausedMs + Math.max(0, now - phase.pausedAt),
    },
  }
}

/** Abandons a focus session. It isn't recorded and doesn't count. */
export function cancel(state: TimerState, now: number): TimerState {
  const { phase } = state
  if (!phase || phase.kind !== 'focus' || hasEnded(phase, now)) return state
  return { ...state, phase: null }
}

/** Ends a break early and starts the next focus session straight away. */
export function skipBreak(
  state: TimerState,
  options: {
    id: string
    subjectId: string | null
    now: number
    durations: Durations
  },
): TimerState {
  const { phase } = state
  if (!phase || !isBreak(phase.kind)) return state
  const cycle = phase.kind === 'long-break' ? 0 : state.completedInCycle
  return start({ ...state, phase: null, completedInCycle: cycle }, options)
}

export interface EndedPhase {
  phase: ActivePhase
  /** When it ended: its scheduled end, even if noticed later. */
  endedAt: number
}

/**
 * Moves the clock forward to `now`: every phase whose time ran out ends at its
 * scheduled time, even if the app was closed then. A finished focus session
 * starts its break at that moment; a finished break leaves the timer ready for
 * the next session. Paused phases never end.
 */
export function advance(
  state: TimerState,
  durations: Durations,
  now: number,
): { state: TimerState; ended: EndedPhase[] } {
  let current = state
  const ended: EndedPhase[] = []
  while (current.phase && hasEnded(current.phase, now)) {
    const phase = current.phase
    const endedAt = scheduledEnd(phase)!
    ended.push({ phase, endedAt })
    if (phase.kind === 'focus') {
      const completedInCycle = current.completedInCycle + 1
      const kind =
        completedInCycle >= SESSIONS_BEFORE_LONG_BREAK
          ? 'long-break'
          : 'short-break'
      current = {
        ...current,
        completedInCycle,
        // Derived from the session's id, so every tab arrives at the same break.
        phase: newPhase(`${phase.id}:break`, kind, null, endedAt, durations),
      }
    } else {
      current = {
        ...current,
        phase: null,
        completedInCycle:
          phase.kind === 'long-break' ? 0 : current.completedInCycle,
      }
    }
  }
  return { state: current, ended }
}

/** The record kept for a finished focus session. */
export function sessionFor(phase: ActivePhase, endedAt: number): FocusSession {
  const ended = new Date(endedAt).toISOString()
  return {
    id: phase.id,
    subjectId: phase.subjectId,
    startedAt: new Date(phase.startedAt).toISOString(),
    endedAt: ended,
    durationMs: phase.durationMs,
    pausedMs: phase.pausedMs,
    // Sessions that cross midnight count toward the day they started.
    day: toDateKey(new Date(phase.startedAt)),
    createdAt: ended,
    updatedAt: ended,
  }
}

/** Which session in the cycle comes next (1–4). */
export function sessionNumber(state: TimerState): number {
  const phase = state.phase
  const done = state.completedInCycle
  if (phase?.kind === 'focus')
    return Math.min(done + 1, SESSIONS_BEFORE_LONG_BREAK)
  if (phase?.kind === 'long-break') return SESSIONS_BEFORE_LONG_BREAK
  return (done % SESSIONS_BEFORE_LONG_BREAK) + 1
}
