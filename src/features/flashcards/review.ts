import { habitsStore, isDone, liveHabits, toggleHabit } from '@/features/habits'
import { toDateKey } from '@/lib/date'
import { createId } from '@/lib/id'
import { cards } from './cards'
import { dueCounts } from './lib/queue'
import { logReview, unlogReview } from './reviews'
import { cardSettingsStore } from './settings'
import type { CardReview, FlashCard, Rating, Schedule } from './types'

const DAY = 86_400_000

/** A rating given, with what it replaced (for Undo). */
export interface Rated {
  card: FlashCard
  review: CardReview
  previous: FlashCard
}

/**
 * A rating, worked out: the card with its new schedule (the outcome shown
 * for it) and the line for the review log. Nothing is saved yet.
 */
export function rateCard(
  card: FlashCard,
  rating: Rating,
  next: Schedule,
  {
    now = new Date(),
    durationMs = null,
  }: { now?: Date; durationMs?: number | null } = {},
): Rated {
  const day = toDateKey(now)
  const stamp = now.toISOString()
  const last = card.schedule.lastReview
  return {
    previous: card,
    card: {
      ...card,
      schedule: next,
      introducedOn: card.introducedOn ?? day,
      updatedAt: stamp,
    },
    review: {
      id: createId(),
      cardId: card.id,
      rating,
      day,
      reviewedAt: stamp,
      state: card.schedule.state,
      elapsedDays: last
        ? Math.max(
            0,
            Math.round(((now.getTime() - Date.parse(last)) / DAY) * 1000) /
              1000,
          )
        : 0,
      due: next.due,
      stability: next.stability,
      difficulty: next.difficulty,
      durationMs,
      createdAt: stamp,
      updatedAt: stamp,
      deletedAt: null,
    },
  }
}

/**
 * Saves a rating: the card, then a line in the review log (one that can't
 * be written doesn't stop you), then the habit if the day's cards are done.
 */
export async function saveRating(
  rated: Rated,
  now: Date = new Date(),
): Promise<void> {
  await cards.put(rated.card)
  await logReview(rated.review).catch((error: unknown) =>
    console.warn('[momentum] The review log could not be written.', error),
  )
  await markHabit(now)
}

/** Works out a rating and saves it. */
export async function recordRating(
  card: FlashCard,
  rating: Rating,
  next: Schedule,
  options: { now?: Date; durationMs?: number | null } = {},
): Promise<Rated> {
  const rated = rateCard(card, rating, next, options)
  await saveRating(rated, options.now)
  return rated
}

/** Takes a rating back: the card as it was, and the log line out. */
export async function undoRating(
  rated: Rated,
  now: Date = new Date(),
): Promise<void> {
  await cards.put({ ...rated.previous, updatedAt: now.toISOString() })
  await unlogReview(rated.review.id).catch(() => {})
}

/** The habit cards count towards, while it exists. */
export function linkedHabit() {
  const { habitId } = cardSettingsStore.get()
  return habitId
    ? liveHabits(habitsStore.get()).find((habit) => habit.id === habitId)
    : undefined
}

/** Once nothing is left to do today, the linked habit is done for the day. */
export async function markHabit(now: Date = new Date()): Promise<boolean> {
  const habit = linkedHabit()
  if (!habit) return false
  const day = toDateKey(now)
  if (isDone(habit.id, day)) return false
  const left = dueCounts(cards.get(), {
    now,
    newPerDay: cardSettingsStore.get().newPerDay,
  })
  if (left.total > 0) return false
  await toggleHabit(habit.id, day, now)
  return true
}
