import { toDateKey } from '@/lib/date'
import type { FlashCard } from '../types'

/** Learning steps due this soon are shown now rather than waited for. */
export const LEARN_AHEAD_MS = 20 * 60_000

export interface QueueOptions {
  now: Date
  /** New cards to start a day, at most. */
  newPerDay: number
  /** Only cards with this subject (null: none); all when left out. */
  subjectId?: string | null
}

/** The last moment of the local day `now` falls in. */
export function endOfDay(now: Date): Date {
  const end = new Date(now)
  end.setHours(23, 59, 59, 999)
  return end
}

const dueAt = (card: FlashCard) => Date.parse(card.schedule.due)
const learning = (card: FlashCard) =>
  card.schedule.state === 'learning' || card.schedule.state === 'relearning'

/** How many new cards can still be started today (the limit is for all subjects). */
export function newLeft(
  cards: readonly FlashCard[],
  { now, newPerDay }: QueueOptions,
): number {
  const today = toDateKey(now)
  const started = cards.filter((card) => card.introducedOn === today).length
  return Math.max(0, newPerDay - started)
}

function ofSubject(cards: readonly FlashCard[], subjectId?: string | null) {
  return subjectId === undefined
    ? cards
    : cards.filter((card) => card.subjectId === subjectId)
}

export interface DueCounts {
  /** Being learnt, due again today. */
  learning: number
  /** Learnt, due today or overdue. */
  review: number
  /** Not studied yet, within today's limit. */
  new: number
  total: number
}

/** What's left to do today. */
export function dueCounts(
  cards: readonly FlashCard[],
  options: QueueOptions,
): DueCounts {
  const end = endOfDay(options.now).getTime()
  let learningCount = 0
  let review = 0
  let fresh = 0
  for (const card of ofSubject(cards, options.subjectId)) {
    if (card.schedule.state === 'new') fresh++
    else if (dueAt(card) <= end) {
      if (learning(card)) learningCount++
      else review++
    }
  }
  const newCount = Math.min(fresh, newLeft(cards, options))
  return {
    learning: learningCount,
    review,
    new: newCount,
    total: learningCount + review + newCount,
  }
}

/**
 * The cards to study now, in order: steps of cards being learnt that are
 * due (or nearly), then reviews due today, oldest first, then new cards in
 * the order they were made, up to today's limit.
 */
export function buildQueue(
  cards: readonly FlashCard[],
  options: QueueOptions,
): FlashCard[] {
  const now = options.now.getTime()
  const end = endOfDay(options.now).getTime()
  const subject = ofSubject(cards, options.subjectId)
  const steps = subject
    .filter((card) => learning(card) && dueAt(card) <= now + LEARN_AHEAD_MS)
    .sort((a, b) => dueAt(a) - dueAt(b))
  const reviews = subject
    .filter((card) => card.schedule.state === 'review' && dueAt(card) <= end)
    .sort((a, b) => dueAt(a) - dueAt(b))
  const fresh = subject
    .filter((card) => card.schedule.state === 'new')
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .slice(0, newLeft(cards, options))
  return [...steps, ...reviews, ...fresh]
}

/** When the next card falls due after today's are done, if any. */
export function nextDue(
  cards: readonly FlashCard[],
  options: Pick<QueueOptions, 'now' | 'subjectId'>,
): Date | null {
  let next = Number.POSITIVE_INFINITY
  const now = options.now.getTime()
  for (const card of ofSubject(cards, options.subjectId)) {
    if (card.schedule.state === 'new') continue
    const due = dueAt(card)
    if (due > now && due < next) next = due
  }
  return Number.isFinite(next) ? new Date(next) : null
}
