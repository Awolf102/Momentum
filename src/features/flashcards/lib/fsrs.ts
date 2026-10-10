import type { Card as FsrsCard } from 'ts-fsrs'
import type { Schedule } from '../types'
import { CARD_STATES } from './schedule'

/** A schedule as FSRS takes it (it works out elapsed days itself). */
export function toFsrs(schedule: Schedule): FsrsCard {
  return {
    due: new Date(schedule.due),
    stability: schedule.stability,
    difficulty: schedule.difficulty,
    elapsed_days: 0,
    scheduled_days: schedule.scheduledDays,
    learning_steps: schedule.learningSteps,
    reps: schedule.reps,
    lapses: schedule.lapses,
    state: CARD_STATES.indexOf(schedule.state),
    last_review: schedule.lastReview
      ? new Date(schedule.lastReview)
      : undefined,
  }
}

export function fromFsrs(card: FsrsCard): Schedule {
  return {
    state: CARD_STATES[card.state] ?? 'new',
    due: card.due.toISOString(),
    stability: card.stability,
    difficulty: card.difficulty,
    scheduledDays: card.scheduled_days,
    learningSteps: card.learning_steps,
    reps: card.reps,
    lapses: card.lapses,
    lastReview: card.last_review ? card.last_review.toISOString() : null,
  }
}
