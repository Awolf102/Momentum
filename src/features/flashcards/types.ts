import type { CollectionRecord } from '@/lib/collection'
import type { DateKey } from '@/lib/date'

/** Where a card is in being learnt, as the scheduler (FSRS) sees it. */
export type CardState = 'new' | 'learning' | 'review' | 'relearning'

/** How well you remembered: Again, Hard, Good or Easy. */
export type Rating = 1 | 2 | 3 | 4

/** When a card is next due, and what FSRS knows about your memory of it. */
export interface Schedule {
  state: CardState
  /** When it's next shown. A new card is due as soon as it's made. */
  due: string
  /** Days until the chance of recalling it falls to 90%. */
  stability: number
  /** How hard it is to remember, from 1 to 10. */
  difficulty: number
  /** Days from the last review to `due`. */
  scheduledDays: number
  /** The step reached while (re)learning it. */
  learningSteps: number
  reps: number
  /** Times it was forgotten after being learnt. */
  lapses: number
  lastReview: string | null
}

/** Where a card came from, to lead back there. */
export interface CardSource {
  kind: 'note' | 'document'
  id: string
  /** A document's page. */
  page: number | null
}

export interface FlashCard extends CollectionRecord {
  /** The question side, in markdown (maths and code included). */
  front: string
  /** The answer side. */
  back: string
  subjectId: string | null
  source: CardSource | null
  schedule: Schedule
  /** The day it was first reviewed: new cards a day are limited. */
  introducedOn: DateKey | null
}

/** One rating given to a card, for statistics (and fitting FSRS to you). */
export interface CardReview extends CollectionRecord {
  cardId: string
  rating: Rating
  /** The local day it was given. */
  day: DateKey
  reviewedAt: string
  /** The card's state before. */
  state: CardState
  /** Days since the review before (0 for a new card). */
  elapsedDays: number
  /** The schedule it led to. */
  due: string
  stability: number
  difficulty: number
  /** How long the answer took, while the card was showing. */
  durationMs: number | null
}

/** A card not saved yet: written, imported from a note, or suggested. */
export interface CardDraft {
  front: string
  back: string
  source?: CardSource | null
}
