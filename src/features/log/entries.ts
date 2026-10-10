import { createCollection } from '@/lib/collection'
import { isDateKey, type DateKey } from '@/lib/date'
import { isRecord } from '@/lib/guards'
import { cleanLine } from './lib/text'
import type { LogEntry } from './types'

export function parseEntry(value: unknown): LogEntry | null {
  if (!isRecord(value)) return null
  const { id, day, text, createdAt, updatedAt, deletedAt } = value
  if (!isDateKey(day) || id !== day || typeof text !== 'string') return null
  if (typeof updatedAt !== 'string') return null
  return {
    id: day,
    day,
    text: cleanLine(text),
    createdAt: typeof createdAt === 'string' ? createdAt : updatedAt,
    updatedAt,
    deletedAt: typeof deletedAt === 'string' ? deletedAt : null,
  }
}

/** The daily log: one record per day, in IndexedDB. */
export const logEntries = createCollection<LogEntry>({
  name: 'logEntries',
  parse: parseEntry,
})

/** The line for a day, or '' if there isn't one. */
export function lineFor(day: DateKey): string {
  const entry = logEntries.find(day)
  return entry && !entry.deletedAt ? entry.text : ''
}

/**
 * Writes the line for a day. Saving an empty line deletes it (softly, so a
 * backup restored elsewhere doesn't bring it back).
 */
export async function setLine(
  day: DateKey,
  text: string,
  now: Date = new Date(),
): Promise<void> {
  const line = cleanLine(text)
  const existing = logEntries.find(day)
  const live = existing && !existing.deletedAt ? existing : undefined
  if (line === (live?.text ?? '')) return
  if (!line) {
    await logEntries.remove(day, now)
    return
  }
  const time = now.toISOString()
  await logEntries.put({
    id: day,
    day,
    text: line,
    createdAt: live?.createdAt ?? time,
    updatedAt: time,
    deletedAt: null,
  })
}
