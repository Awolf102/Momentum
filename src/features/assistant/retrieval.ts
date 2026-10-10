import { localModelStore, modelStored } from '@/features/ai'
import {
  chunkSource,
  currentSources,
  currentTarget,
  excludedKeys,
  indexedCount,
  searchByMeaning,
  type Source,
} from '@/features/embeddings'
import {
  buildIndex,
  countTerms,
  fuse,
  rank,
  type Bm25Index,
  type Counted,
} from './lib/bm25'
import { mergeByPage } from './lib/passages'
import type { SourceRef } from './types'

/**
 * Passages sent with a question, at most, and from one source (neighbours
 * on a page are then joined into one).
 */
export const PASSAGES = 6
const PER_SOURCE = 3
/** Candidates each way, before they're combined. */
const CANDIDATES = 20

// Each source's passages with their word counts, worked out once per
// version of it (sources are replaced when their notes or pages change).
const counted = new WeakMap<Source, Counted<SourceRef>[]>()
function passagesOf(source: Source): Counted<SourceRef>[] {
  let passages = counted.get(source)
  if (!passages) {
    passages = chunkSource(source).map((chunk) =>
      countTerms(
        {
          key: source.key,
          kind: source.kind,
          id: source.id,
          title: source.title,
          page: chunk.page,
          text: chunk.text,
        },
        `${source.title}\n${chunk.text}`,
      ),
    )
    counted.set(source, passages)
  }
  return passages
}

let corpus: { sources: readonly Source[]; index: Bm25Index<SourceRef> } | null =
  null

async function keywordIndex(): Promise<{
  sources: readonly Source[]
  index: Bm25Index<SourceRef>
}> {
  const sources = await currentSources()
  const same =
    corpus &&
    corpus.sources.length === sources.length &&
    corpus.sources.every((source, i) => source === sources[i])
  if (!same)
    corpus = { sources, index: buildIndex(sources.flatMap(passagesOf)) }
  return corpus!
}

/**
 * How passages can be found by meaning: on this device (as you type,
 * nothing sent), through a provider (only when asked, as the question is
 * sent), or not at all (no index yet).
 */
export async function meaningAvailable(): Promise<
  'device' | 'provider' | null
> {
  const target = currentTarget()
  if (!target || (await indexedCount()) === 0) return null
  if (!target.local) return 'provider'
  return modelStored(localModelStore.get()) ? 'device' : null
}

export interface FindOptions {
  /** Only this document's passages. */
  documentId?: string | null
  /** Also find passages by meaning (sends the question with a provider). */
  meaning?: boolean
  signal?: AbortSignal
}

const passageKey = (passage: SourceRef) =>
  `${passage.key}\u0001${passage.page ?? ''}\u0001${passage.text}`

/** Where a passage sits in its source, so neighbours can be joined. */
const positionIn = (source: Source | undefined, passage: SourceRef) =>
  source
    ? passagesOf(source).findIndex(
        ({ item }) => item.page === passage.page && item.text === passage.text,
      )
    : -1

/**
 * The passages from your notes and documents most likely to answer a
 * question: by its words, and by meaning when asked, a few per source.
 * What you keep out of search by meaning is kept out here too, unless it's
 * the document being asked about.
 */
export async function findPassages(
  question: string,
  { documentId = null, meaning = false, signal }: FindOptions = {},
): Promise<SourceRef[]> {
  const only = documentId ? `document:${documentId}` : undefined
  const { sources, index } = await keywordIndex()
  const excluded = excludedKeys()
  const byWords = rank(index, question, CANDIDATES, (passage) =>
    only ? passage.key === only : !excluded.has(passage.key),
  ).map((hit) => hit.item)
  const lists = [byWords]
  const byKey = new Map(sources.map((source) => [source.key, source]))
  if (meaning && question.trim()) {
    const { hits } = await searchByMeaning(question, {
      signal,
      only,
      limit: CANDIDATES,
      perSource: 6,
    })
    lists.unshift(
      hits
        .filter((hit) => byKey.has(hit.key))
        .map((hit) => ({
          key: hit.key,
          kind: hit.kind,
          id: hit.id,
          title: byKey.get(hit.key)!.title,
          page: hit.page,
          text: hit.text,
        })),
    )
  }
  const perSource = new Map<string, number>()
  const chosen: SourceRef[] = []
  for (const passage of fuse(lists, passageKey)) {
    const count = perSource.get(passage.key) ?? 0
    if (count >= PER_SOURCE && !only) continue
    perSource.set(passage.key, count + 1)
    chosen.push(passage)
    if (chosen.length >= PASSAGES) break
  }
  // About the whole of one document (summarise it, quiz me on it), a
  // question has few of its words: the rest are spread through it.
  const document = only ? byKey.get(only) : undefined
  if (document && chosen.length < PASSAGES) {
    const taken = new Set(chosen.map(passageKey))
    const rest = passagesOf(document)
      .map(({ item }) => item)
      .filter((passage) => !taken.has(passageKey(passage)))
    const wanted = Math.min(PASSAGES - chosen.length, rest.length)
    for (let i = 0; i < wanted; i++)
      chosen.push(rest[Math.floor((i * rest.length) / wanted)])
  }
  return mergeByPage(
    chosen.map((item) => ({
      item,
      position: positionIn(byKey.get(item.key), item),
    })),
  )
}
