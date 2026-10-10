import { createCollection } from '@/lib/collection'
import { isDateKey } from '@/lib/date'
import { isRecord } from '@/lib/guards'
import { MAX_SIDE } from './lib/limits'
import { parseSchedule } from './lib/schedule'
import type { CardSource, FlashCard } from './types'

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
