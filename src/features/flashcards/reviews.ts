import { addDays, type DateKey } from '@/lib/date'
import { getDb } from '@/lib/db/db'
import { isRecord } from '@/lib/guards'
import { createStore } from '@/lib/store'
import { CARD_STATES } from './lib/schedule'
import type { CardReview, CardState, Rating } from './types'

/**
 * The review log: every rating ever given, so it isn't loaded whole. It's
 * read by day (for "reviewed today" and the week), and backed up with the
 * rest; fitting FSRS's parameters to you can use it later.
 */

/** Bumped whenever the log changes here, so views can read it again. */
export const reviewLogVersion = createStore(0)

const RATINGS: readonly number[] = [1, 2, 3, 4]

export function parseReview(value: unknown): CardReview | null {
  if (!isRecord(value)) return null
  const { id, cardId, rating, day, reviewedAt, state, updatedAt } = value
  if (typeof id !== 'string' || typeof cardId !== 'string') return null
  if (!RATINGS.includes(rating as number) || typeof day !== 'string')
    return null
  if (typeof reviewedAt !== 'string' || typeof updatedAt !== 'string')
    return null
  const number = (field: unknown) =>
    typeof field === 'number' && Number.isFinite(field) ? field : 0
  return {
    id,
    cardId,
    rating: rating as Rating,
    day,
    reviewedAt,
    state: CARD_STATES.includes(state as CardState)
      ? (state as CardState)
      : 'new',
    elapsedDays: number(value.elapsedDays),
    due: typeof value.due === 'string' ? value.due : reviewedAt,
    stability: number(value.stability),
    difficulty: number(value.difficulty),
    durationMs: typeof value.durationMs === 'number' ? value.durationMs : null,
    createdAt:
      typeof value.createdAt === 'string' ? value.createdAt : updatedAt,
    updatedAt,
    deletedAt: typeof value.deletedAt === 'string' ? value.deletedAt : null,
  }
}

export async function logReview(review: CardReview): Promise<void> {
  await (await getDb()).put('cardReviews', { ...review })
  reviewLogVersion.set((version) => version + 1)
}

/** Takes a review back out (Undo). */
export async function unlogReview(id: string): Promise<void> {
  await (await getDb()).delete('cardReviews', id)
  reviewLogVersion.set((version) => version + 1)
}

/** The reviews given on the days from `from` to `to`, inclusive. */
export async function reviewsBetween(
  from: DateKey,
  to: DateKey,
): Promise<CardReview[]> {
  const db = await getDb()
  const rows = await db.getAllFromIndex(
    'cardReviews',
    'by-day',
    IDBKeyRange.bound(from, to),
  )
  return rows
    .map(parseReview)
    .filter(
      (review): review is CardReview => review !== null && !review.deletedAt,
    )
}

/** Reviews per day over the last `days` days, ending with `today`. */
export async function reviewsByDay(
  today: DateKey,
  days: number,
): Promise<Map<DateKey, CardReview[]>> {
  const from = addDays(today, -(days - 1))
  const byDay = new Map<DateKey, CardReview[]>()
  for (const review of await reviewsBetween(from, today)) {
    const list = byDay.get(review.day)
    if (list) list.push(review)
    else byDay.set(review.day, [review])
  }
  return byDay
}

/** Forgets every review ("delete all cards"). */
export async function clearReviews(): Promise<void> {
  await (await getDb()).clear('cardReviews')
  reviewLogVersion.set((version) => version + 1)
}
