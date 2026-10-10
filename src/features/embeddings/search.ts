import { ai } from '@/features/ai'
import { createStore } from '@/lib/store'
import { currentTarget, type Target } from './indexer'
import { promptsFor } from './lib/prompts'
import {
  meanVector,
  rowScore,
  TopK,
  unit,
  type VectorRows,
} from './lib/vectors'
import { onIndexChange, readSourceRecords, readVectors } from './storage'
import type { MeaningHit, SourceRecord, VectorRecord } from './types'

interface Entry {
  record: SourceRecord
  vectors: VectorRecord
  rows: VectorRows
}

const toEntry = (record: SourceRecord, vectors: VectorRecord): Entry => ({
  record,
  vectors,
  rows: { dims: vectors.dims, values: vectors.values, scales: vectors.scales },
})

// The index for the model in use, read from the database when first needed
// and then kept up to date as entries change.
let loaded: {
  space: string
  entries: Map<string, Entry>
  ready: Promise<void>
} | null = null

/** Changes when the index does, so lists made from it can refresh. */
export const indexVersionStore = createStore(0)

function entriesFor(space: string): Promise<Map<string, Entry>> {
  if (loaded?.space !== space) {
    const entries = new Map<string, Entry>()
    const ready = (async () => {
      const records = (await readSourceRecords()).filter(
        (record) => record.space === space && record.chunks > 0,
      )
      const byKey = new Map(records.map((record) => [record.key, record]))
      for (const vectors of await readVectors([...byKey.keys()]))
        entries.set(vectors.key, toEntry(byKey.get(vectors.key)!, vectors))
    })()
    loaded = { space, entries, ready }
  }
  const { entries, ready } = loaded
  return ready.then(() => entries)
}

onIndexChange((change) => {
  const state = loaded
  if (!state) return
  if ('cleared' in change) {
    loaded = null
    indexVersionStore.set((version) => version + 1)
    return
  }
  void (async () => {
    await state.ready
    const records = new Map(
      (await readSourceRecords())
        .filter((record) => change.keys.includes(record.key))
        .map((record) => [record.key, record]),
    )
    const vectors = new Map(
      (await readVectors(change.keys)).map((row) => [row.key, row]),
    )
    for (const key of change.keys) {
      const record = records.get(key)
      const row = vectors.get(key)
      if (record && row && record.space === state.space && record.chunks > 0)
        state.entries.set(key, toEntry(record, row))
      else state.entries.delete(key)
    }
    indexVersionStore.set((version) => version + 1)
  })()
})

/** How many notes and documents the index can search with the model in use. */
export async function indexedCount(): Promise<number> {
  const target = currentTarget()
  return target ? (await entriesFor(target.space)).size : 0
}

// Recent searches' vectors, so going back to a search doesn't send it again.
const queryVectors = new Map<string, Float32Array>()
const REMEMBERED = 50

async function queryVector(
  query: string,
  target: Target,
  signal?: AbortSignal,
): Promise<Float32Array> {
  const key = `${target.space}\n${query}`
  const remembered = queryVectors.get(key)
  if (remembered) return remembered
  const [vector] = await ai.embed([promptsFor(target.model).query + query], {
    signal,
  })
  const result = unit(vector)
  queryVectors.set(key, result)
  if (queryVectors.size > REMEMBERED)
    queryVectors.delete(queryVectors.keys().next().value!)
  return result
}

interface NearestOptions {
  /** Leave this source out (the one you're looking from). */
  exclude?: string
  perSource: number
  limit: number
}

/**
 * The passages nearest a vector: one per page (or note), a few per source
 * at most, so one long document doesn't crowd out everything else.
 */
function nearest(
  entries: ReadonlyMap<string, Entry>,
  vector: Float32Array,
  { exclude, perSource, limit }: NearestOptions,
): MeaningHit[] {
  const top = new TopK<{ entry: Entry; row: number }>(limit * 8)
  for (const entry of entries.values()) {
    if (entry.record.key === exclude || entry.rows.dims !== vector.length)
      continue
    const count = entry.rows.scales.length
    for (let row = 0; row < count; row++) {
      const score = rowScore(entry.rows, row, vector)
      if (score > top.bar) top.add({ entry, row }, score)
    }
  }
  const hits: MeaningHit[] = []
  const pages = new Set<string>()
  const perKey = new Map<string, number>()
  for (const {
    item: { entry, row },
    score,
  } of top.best()) {
    const { key, kind, id } = entry.record
    const page = entry.vectors.pages[row] ?? null
    const pageKey = `${key}#${page ?? ''}`
    const used = perKey.get(key) ?? 0
    if (pages.has(pageKey) || used >= perSource) continue
    pages.add(pageKey)
    perKey.set(key, used + 1)
    hits.push({ key, kind, id, page, text: entry.vectors.texts[row], score })
    if (hits.length >= limit) break
  }
  return hits
}

/**
 * Matches scoring below this are no closer than unrelated texts usually
 * are. Measured for the small model on this device (unrelated texts score
 * up to about 0.15). Other models score on their own scales, so the floor
 * is lower for them, and the cut relative to the best match does the work.
 */
const minScore = (target: Target) => (target.local ? 0.2 : 0.1)
/** Matches this far below the best one are left out too. */
const BEST_SPREAD = 0.25

/** The hits worth showing: close enough, and not far behind the best. */
function closeEnough(hits: MeaningHit[], target: Target): MeaningHit[] {
  const bar = Math.max(minScore(target), (hits[0]?.score ?? 0) - BEST_SPREAD)
  return hits.filter((hit) => hit.score >= bar)
}

export interface MeaningResults {
  hits: MeaningHit[]
  /** Notes and documents searched. */
  searched: number
}

/**
 * Passages that mean something like the query. With a provider, the query
 * itself is sent to be turned into a vector; with the model on this
 * device, nothing leaves it.
 */
export async function searchByMeaning(
  query: string,
  signal?: AbortSignal,
): Promise<MeaningResults> {
  const target = currentTarget()
  if (!target) return { hits: [], searched: 0 }
  const entries = await entriesFor(target.space)
  if (entries.size === 0) return { hits: [], searched: 0 }
  const vector = await queryVector(query.trim(), target, signal)
  return {
    hits: closeEnough(
      nearest(entries, vector, { perSource: 3, limit: 8 }),
      target,
    ),
    searched: entries.size,
  }
}

/**
 * Notes and document pages close in meaning to a note or document, from
 * vectors already in the index: nothing is sent.
 */
export async function relatedTo(key: string, limit = 5): Promise<MeaningHit[]> {
  const target = currentTarget()
  if (!target) return []
  const entries = await entriesFor(target.space)
  const entry = entries.get(key)
  if (!entry) return []
  return closeEnough(
    nearest(entries, meanVector(entry.rows), {
      exclude: key,
      perSource: 1,
      limit,
    }),
    target,
  )
}
