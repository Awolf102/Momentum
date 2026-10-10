import type { CardState, Schedule } from '../types'

/** In FSRS's order: its State enum is the index. */
export const CARD_STATES: readonly CardState[] = [
  'new',
  'learning',
  'review',
  'relearning',
]

/** A card that hasn't been studied: due now. */
export function newSchedule(now: Date): Schedule {
  return {
    state: 'new',
    due: now.toISOString(),
    stability: 0,
    difficulty: 0,
    scheduledDays: 0,
    learningSteps: 0,
    reps: 0,
    lapses: 0,
    lastReview: null,
  }
}

const finite = (value: unknown, fallback = 0) =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback

/** A stored schedule, checked; a damaged one starts the card afresh. */
export function parseSchedule(value: unknown, now: Date): Schedule {
  if (typeof value !== 'object' || value === null) return newSchedule(now)
  const raw = value as Record<string, unknown>
  const state = CARD_STATES.includes(raw.state as CardState)
    ? (raw.state as CardState)
    : null
  const due = typeof raw.due === 'string' ? Date.parse(raw.due) : Number.NaN
  if (!state || Number.isNaN(due)) return newSchedule(now)
  const lastReview =
    typeof raw.lastReview === 'string' &&
    !Number.isNaN(Date.parse(raw.lastReview))
      ? raw.lastReview
      : null
  return {
    state,
    due: new Date(due).toISOString(),
    stability: Math.max(0, finite(raw.stability)),
    difficulty: Math.min(10, Math.max(0, finite(raw.difficulty))),
    scheduledDays: Math.max(0, finite(raw.scheduledDays)),
    learningSteps: Math.max(0, Math.round(finite(raw.learningSteps))),
    reps: Math.max(0, Math.round(finite(raw.reps))),
    lapses: Math.max(0, Math.round(finite(raw.lapses))),
    lastReview,
  }
}
