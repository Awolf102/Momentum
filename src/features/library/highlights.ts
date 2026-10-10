import { createCollection } from '@/lib/collection'
import { isRecord } from '@/lib/guards'
import { createId } from '@/lib/id'
import {
  HIGHLIGHT_COLORS,
  type Highlight,
  type HighlightColor,
  type PageRect,
} from './types'

export const MAX_NOTE_LENGTH = 5000

const isFraction = (value: unknown): value is number =>
  typeof value === 'number' &&
  Number.isFinite(value) &&
  value >= -0.01 &&
  value <= 1.01

function parseRect(value: unknown): PageRect | null {
  if (!isRecord(value)) return null
  const { x, y, w, h } = value
  if (![x, y, w, h].every(isFraction)) return null
  return { x, y, w, h } as PageRect
}

export function parseHighlight(value: unknown): Highlight | null {
  if (!isRecord(value)) return null
  const { id, documentId, page, rects, quote, color, note } = value
  const { createdAt, updatedAt } = value
  if (typeof id !== 'string' || typeof documentId !== 'string') return null
  if (typeof createdAt !== 'string' || typeof updatedAt !== 'string')
    return null
  if (typeof page !== 'number' || !Number.isInteger(page) || page < 1)
    return null
  const parsedRects = Array.isArray(rects)
    ? rects.map(parseRect).filter((rect) => rect !== null)
    : []
  if (parsedRects.length === 0) return null
  return {
    id,
    documentId,
    page,
    rects: parsedRects,
    quote: typeof quote === 'string' ? quote : '',
    color: HIGHLIGHT_COLORS.includes(color as HighlightColor)
      ? (color as HighlightColor)
      : 'yellow',
    note: typeof note === 'string' ? note.slice(0, MAX_NOTE_LENGTH) : '',
    createdAt,
    updatedAt,
    deletedAt: typeof value.deletedAt === 'string' ? value.deletedAt : null,
  }
}

/** Every highlight, in every document. */
export const highlights = createCollection<Highlight>({
  name: 'highlights',
  parse: parseHighlight,
})

export async function addHighlight(
  input: Pick<Highlight, 'documentId' | 'page' | 'rects' | 'quote' | 'color'>,
  now: Date = new Date(),
): Promise<Highlight> {
  const stamp = now.toISOString()
  const highlight: Highlight = {
    ...input,
    id: createId(),
    quote: input.quote.replace(/\s+/g, ' ').trim(),
    note: '',
    createdAt: stamp,
    updatedAt: stamp,
    deletedAt: null,
  }
  await highlights.add(highlight)
  return highlight
}

export async function updateHighlight(
  id: string,
  changes: Partial<Pick<Highlight, 'color' | 'note'>>,
  now: Date = new Date(),
): Promise<void> {
  const highlight = highlights.find(id)
  if (!highlight || highlight.deletedAt) return
  const next = {
    ...highlight,
    ...changes,
    note: (changes.note ?? highlight.note).slice(0, MAX_NOTE_LENGTH),
  }
  if (next.color === highlight.color && next.note === highlight.note) return
  await highlights.put({ ...next, updatedAt: now.toISOString() })
}

export async function deleteHighlight(id: string, now: Date = new Date()) {
  await highlights.remove(id, now)
}

export async function restoreHighlight(id: string, now: Date = new Date()) {
  const highlight = highlights.find(id)
  if (!highlight?.deletedAt) return
  await highlights.put({
    ...highlight,
    deletedAt: null,
    updatedAt: now.toISOString(),
  })
}
