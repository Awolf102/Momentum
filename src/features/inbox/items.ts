import { createCollection } from '@/lib/collection'
import { isRecord } from '@/lib/guards'
import { createId } from '@/lib/id'
import { findUrl, MAX_TEXT_LENGTH, safeUrl } from './lib/share'
import type { InboxItem } from './types'

export function parseItem(value: unknown): InboxItem | null {
  if (!isRecord(value)) return null
  const { id, text, url, source, createdAt, updatedAt, deletedAt } = value
  if (typeof id !== 'string' || typeof text !== 'string' || !text.trim())
    return null
  if (typeof createdAt !== 'string' || typeof updatedAt !== 'string')
    return null
  return {
    id,
    text: text.trim().slice(0, MAX_TEXT_LENGTH),
    url: typeof url === 'string' ? safeUrl(url) : null,
    source: source === 'shared' ? 'shared' : 'typed',
    createdAt,
    updatedAt,
    deletedAt: typeof deletedAt === 'string' ? deletedAt : null,
  }
}

/** The inbox: everything captured and not yet sorted. */
export const inboxItems = createCollection<InboxItem>({
  name: 'inboxItems',
  parse: parseItem,
})

/** Saves something to the inbox. A link in the text is picked out. */
export async function capture(
  text: string,
  {
    url = null,
    source = 'typed',
    now = new Date(),
  }: { url?: string | null; source?: InboxItem['source']; now?: Date } = {},
): Promise<InboxItem | null> {
  const clean = text.trim().slice(0, MAX_TEXT_LENGTH)
  if (!clean) return null
  const stamp = now.toISOString()
  const item: InboxItem = {
    id: createId(),
    text: clean,
    url: safeUrl(url) ?? findUrl(clean),
    source,
    createdAt: stamp,
    updatedAt: stamp,
    deletedAt: null,
  }
  await inboxItems.add(item)
  return item
}

/** Done with it: sorted elsewhere, or not needed. */
export async function dismiss(id: string, now: Date = new Date()) {
  await inboxItems.remove(id, now)
}
