import { createCollection } from '@/lib/collection'
import { isDateKey } from '@/lib/date'
import { isRecord } from '@/lib/guards'
import { createId } from '@/lib/id'
import { newSchedule, parseSchedule } from './lib/schedule'
import { MAX_SIDE } from './lib/text'
import type { CardDraft, CardSource, FlashCard } from './types'

function parseSource(value: unknown): CardSource | null {
  if (!isRecord(value)) return null
  const { kind, id, page } = value
  if ((kind !== 'note' && kind !== 'document') || typeof id !== 'string')
    return null
  return {
    kind,
    id,
    page:
      kind === 'document' && typeof page === 'number' && Number.isInteger(page)
        ? page
        : null,
  }
}

export function parseCard(value: unknown): FlashCard | null {
  if (!isRecord(value)) return null
  const { id, front, back, subjectId, createdAt, updatedAt, deletedAt } = value
  if (typeof id !== 'string' || typeof updatedAt !== 'string') return null
  if (typeof front !== 'string' || typeof back !== 'string') return null
  const created = typeof createdAt === 'string' ? createdAt : updatedAt
  return {
    id,
    front: front.slice(0, MAX_SIDE),
    back: back.slice(0, MAX_SIDE),
    subjectId: typeof subjectId === 'string' ? subjectId : null,
    source: parseSource(value.source),
    schedule: parseSchedule(value.schedule, new Date(created)),
    introducedOn: isDateKey(value.introducedOn) ? value.introducedOn : null,
    createdAt: created,
    updatedAt,
    deletedAt: typeof deletedAt === 'string' ? deletedAt : null,
  }
}

/** Every flashcard, with when it's next due. */
export const cards = createCollection<FlashCard>({
  name: 'cards',
  parse: parseCard,
})

export interface CardOptions {
  subjectId: string | null
  /** Where the cards came from (each draft can say for itself). */
  source?: CardSource | null
}

export function newCard(
  draft: CardDraft,
  { subjectId, source = null }: CardOptions,
  now: Date = new Date(),
): FlashCard {
  const stamp = now.toISOString()
  return {
    id: createId(),
    front: draft.front.trim().slice(0, MAX_SIDE),
    back: draft.back.trim().slice(0, MAX_SIDE),
    subjectId,
    source: draft.source ?? source,
    schedule: newSchedule(now),
    introducedOn: null,
    createdAt: stamp,
    updatedAt: stamp,
    deletedAt: null,
  }
}

/** Saves new cards, in order (they're studied in the order they were made). */
export async function addCards(
  drafts: readonly CardDraft[],
  options: CardOptions,
  now: Date = new Date(),
): Promise<FlashCard[]> {
  const made: FlashCard[] = []
  for (const [index, draft] of drafts.entries()) {
    if (!draft.front.trim() || !draft.back.trim()) continue
    // A millisecond apart, so their order survives.
    const card = newCard(draft, options, new Date(now.getTime() + index))
    await cards.add(card)
    made.push(card)
  }
  return made
}

/** Changes a card's sides or subject; its schedule is kept. */
export async function editCard(
  id: string,
  changes: Partial<Pick<FlashCard, 'front' | 'back' | 'subjectId'>>,
  now: Date = new Date(),
): Promise<void> {
  const card = cards.find(id)
  if (!card) return
  await cards.put({
    ...card,
    ...changes,
    front: (changes.front ?? card.front).trim().slice(0, MAX_SIDE),
    back: (changes.back ?? card.back).trim().slice(0, MAX_SIDE),
    updatedAt: now.toISOString(),
  })
}

/** Starts a card again as new, forgetting how it went. */
export async function resetCard(
  id: string,
  now: Date = new Date(),
): Promise<void> {
  const card = cards.find(id)
  if (!card) return
  await cards.put({
    ...card,
    schedule: newSchedule(now),
    introducedOn: null,
    updatedAt: now.toISOString(),
  })
}

export async function deleteCards(
  ids: readonly string[],
  now: Date = new Date(),
): Promise<void> {
  for (const id of ids) await cards.remove(id, now)
}

/** Brings deleted cards back, as they were (for Undo). */
export async function restoreCards(
  previous: readonly FlashCard[],
  now: Date = new Date(),
): Promise<void> {
  for (const card of previous)
    await cards.put({ ...card, deletedAt: null, updatedAt: now.toISOString() })
}

/** The card already made from a source with these words on its front, if any. */
export function findSimilar(
  front: string,
  source: CardSource | null,
): FlashCard | undefined {
  const words = front.trim().toLowerCase().replace(/\s+/g, ' ')
  return cards
    .get()
    .find(
      (card) =>
        card.front.trim().toLowerCase().replace(/\s+/g, ' ') === words &&
        card.source?.kind === source?.kind &&
        card.source?.id === source?.id,
    )
}
