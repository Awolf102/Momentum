import { getDb } from '@/lib/db/db'
import { isRecord } from '@/lib/guards'
import type { SourceRecord, VectorRecord } from './types'

/**
 * The index lives in two stores: `embeddingSources` (what each entry was
 * made from, small) and `embeddingVectors` (its passages and vectors). It's
 * derived data, so it's never backed up: it can be built again.
 */

function parseSource(value: unknown): SourceRecord | null {
  if (!isRecord(value)) return null
  const { key, hash, space, kind, id, dims, chunks, indexedAt } = value
  if (
    typeof key !== 'string' ||
    typeof hash !== 'string' ||
    typeof space !== 'string' ||
    (kind !== 'note' && kind !== 'document') ||
    typeof id !== 'string' ||
    typeof dims !== 'number' ||
    typeof chunks !== 'number' ||
    typeof indexedAt !== 'string'
  )
    return null
  return { key, hash, space, kind, id, dims, chunks, indexedAt }
}

function parseVectors(value: unknown): VectorRecord | null {
  if (!isRecord(value)) return null
  const { key, pages, texts, dims, values, scales } = value
  if (
    typeof key !== 'string' ||
    !Array.isArray(pages) ||
    !Array.isArray(texts) ||
    typeof dims !== 'number' ||
    !(values instanceof Int8Array) ||
    !(scales instanceof Float32Array) ||
    texts.length !== scales.length ||
    values.length !== scales.length * dims
  )
    return null
  return {
    key,
    pages: pages.map((page) => (typeof page === 'number' ? page : null)),
    texts: texts.map(String),
    dims,
    values,
    scales,
  }
}

export async function readSourceRecords(): Promise<SourceRecord[]> {
  const rows = await (await getDb()).getAll('embeddingSources')
  return rows.map(parseSource).filter((row) => row !== null)
}

export async function readVectors(
  keys: readonly string[],
): Promise<VectorRecord[]> {
  const db = await getDb()
  const tx = db.transaction('embeddingVectors')
  const rows = await Promise.all(keys.map((key) => tx.store.get(key)))
  return rows.map(parseVectors).filter((row) => row !== null)
}

// Other tabs, and this tab's search, hear about changes to the index.
type Change = { keys: string[] } | { cleared: true }
const listeners = new Set<(change: Change) => void>()
const channel =
  typeof BroadcastChannel === 'undefined'
    ? null
    : new BroadcastChannel('momentum-embeddings')
if (channel)
  channel.onmessage = (event: MessageEvent<Change>) => {
    for (const listener of listeners) listener(event.data)
  }

function announce(change: Change) {
  for (const listener of listeners) listener(change)
  channel?.postMessage(change)
}

export function onIndexChange(listener: (change: Change) => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** Saves a source's entry: its record and its vectors together. */
export async function saveIndexed(
  record: SourceRecord,
  vectors: VectorRecord,
): Promise<void> {
  const db = await getDb()
  const tx = db.transaction(
    ['embeddingSources', 'embeddingVectors'],
    'readwrite',
  )
  await Promise.all([
    tx.objectStore('embeddingSources').put({ ...record }),
    tx.objectStore('embeddingVectors').put({ ...vectors }),
    tx.done,
  ])
  announce({ keys: [record.key] })
}

export async function removeIndexed(keys: readonly string[]): Promise<void> {
  if (keys.length === 0) return
  const db = await getDb()
  const tx = db.transaction(
    ['embeddingSources', 'embeddingVectors'],
    'readwrite',
  )
  await Promise.all([
    ...keys.flatMap((key) => [
      tx.objectStore('embeddingSources').delete(key),
      tx.objectStore('embeddingVectors').delete(key),
    ]),
    tx.done,
  ])
  announce({ keys: [...keys] })
}

export async function clearIndex(): Promise<void> {
  const db = await getDb()
  const tx = db.transaction(
    ['embeddingSources', 'embeddingVectors'],
    'readwrite',
  )
  await Promise.all([
    tx.objectStore('embeddingSources').clear(),
    tx.objectStore('embeddingVectors').clear(),
    tx.done,
  ])
  announce({ cleared: true })
}
