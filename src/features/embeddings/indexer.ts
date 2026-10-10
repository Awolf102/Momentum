import {
  ai,
  aiReadiness,
  aiSettingsStore,
  checkLocalModel,
  describeAiError,
  isAiError,
  localModelStore,
  PROVIDERS,
  type ProviderId,
} from '@/features/ai'
import { storeRegistry } from '@/lib/persistentStore'
import { savedSecretsStore } from '@/lib/secrets'
import { createStore } from '@/lib/store'
import type { Chunk } from './lib/chunk'
import { estimateTokens, planIndex } from './lib/plan'
import { promptsFor } from './lib/prompts'
import { packRows } from './lib/vectors'
import { excludedKeys } from './settings'
import {
  chunkSource,
  currentSources,
  onSourcesChange,
  passageText,
} from './sources'
import { readSourceRecords, removeIndexed, saveIndexed } from './storage'
import type { Source } from './types'

/** The embeddings model in use, from Settings → AI. */
export interface Target {
  /** Vectors from different models can't be compared: "provider:model". */
  space: string
  provider: ProviderId
  model: string
  label: string
  /** The model runs on this device, so nothing is sent anywhere. */
  local: boolean
}

export function currentTarget(): Target | null {
  const readiness = aiReadiness(
    aiSettingsStore.get(),
    savedSecretsStore.get(),
    'embeddings',
  )
  if (!readiness.ready) return null
  const meta = PROVIDERS[readiness.provider]
  return {
    space: `${readiness.provider}:${readiness.model}`,
    provider: readiness.provider,
    model: readiness.model,
    label: meta.label,
    local: meta.local,
  }
}

const chunked = new WeakMap<Source, Chunk[]>()
function chunksOf(source: Source): Chunk[] {
  let chunks = chunked.get(source)
  if (!chunks) chunked.set(source, (chunks = chunkSource(source)))
  return chunks
}

/** A note or document waiting to be indexed, and how much would be sent. */
export interface PendingSource {
  source: Source
  passages: number
  /** Characters sent, titles included. */
  chars: number
}

export interface IndexOverview {
  target: Target
  pending: PendingSource[]
  /** Kept out of the index, and so never sent. */
  excluded: PendingSource[]
  indexed: { notes: number; documents: number; passages: number }
}

/** Where the index stands: what's in it, and what's waiting. */
export async function indexOverview(): Promise<IndexOverview | null> {
  await storeRegistry.settled()
  const target = currentTarget()
  if (!target) return null
  const sources = await currentSources()
  const records = await readSourceRecords()
  const excluded = excludedKeys()
  const plan = planIndex(sources, records, target.space, excluded)
  const chunkCount = new Map(
    records.map((record) => [record.key, record.chunks]),
  )
  const prefix = promptsFor(target.model).passage
  const measure = (source: Source): PendingSource => {
    const chunks = chunksOf(source)
    return {
      source,
      passages: chunks.length,
      chars: chunks.reduce(
        (sum, chunk) => sum + passageText(source, chunk, prefix).length,
        0,
      ),
    }
  }
  return {
    target,
    pending: plan.embed.map(measure),
    excluded: sources.filter((source) => excluded.has(source.key)).map(measure),
    indexed: {
      notes: plan.current.filter((source) => source.kind === 'note').length,
      documents: plan.current.filter((source) => source.kind === 'document')
        .length,
      passages: plan.current.reduce(
        (sum, source) => sum + (chunkCount.get(source.key) ?? 0),
        0,
      ),
    },
  }
}

export type IndexStatus =
  | { state: 'idle' }
  | { state: 'running'; done: number; total: number; auto: boolean }
  | { state: 'error'; message: string }

export const indexStatusStore = createStore<IndexStatus>({ state: 'idle' })

export interface UpdateOptions {
  /** Only these sources (chosen in the preview); the rest wait. */
  only?: ReadonlySet<string>
  /** Only take out what's gone or excluded: nothing is embedded. */
  removalsOnly?: boolean
  /** Started by Momentum, not by you: skipped if the index is busy. */
  auto?: boolean
}

export interface UpdateResult {
  embedded: number
  passages: number
  removed: number
  tokens: number
}

const NOTHING: UpdateResult = {
  embedded: 0,
  passages: 0,
  removed: 0,
  tokens: 0,
}

let controller: AbortController | null = null
let current: Promise<unknown> | null = null

/** Stops the update in progress; what's done so far is kept. */
export function cancelIndexing(): void {
  controller?.abort()
}

async function run(
  options: UpdateOptions,
  signal: AbortSignal,
): Promise<UpdateResult> {
  await storeRegistry.settled()
  const target = currentTarget()
  if (!target) return NOTHING
  const sources = await currentSources()
  const records = await readSourceRecords()
  const plan = planIndex(sources, records, target.space, excludedKeys())
  await removeIndexed(plan.remove)
  const { only } = options
  const work = options.removalsOnly
    ? []
    : only
      ? plan.embed.filter((source) => only.has(source.key))
      : plan.embed
  if (work.length === 0) return { ...NOTHING, removed: plan.remove.length }

  const prefix = promptsFor(target.model).passage
  const jobs = work.map((source) => ({
    source,
    chunks: chunksOf(source),
    vectors: [] as number[][],
    saved: false,
  }))
  const queue = jobs.flatMap((job) =>
    job.chunks.map((chunk, row) => ({
      job,
      row,
      text: passageText(job.source, chunk, prefix),
    })),
  )
  const total = queue.length
  let done = 0
  let tokens = 0
  let embedded = 0
  indexStatusStore.set({
    state: 'running',
    done,
    total,
    auto: Boolean(options.auto),
  })

  async function save(job: (typeof jobs)[number]) {
    const rows = packRows(job.vectors)
    await saveIndexed(
      {
        key: job.source.key,
        hash: job.source.hash,
        space: target!.space,
        kind: job.source.kind,
        id: job.source.id,
        dims: rows.dims,
        chunks: job.chunks.length,
        indexedAt: new Date().toISOString(),
      },
      {
        key: job.source.key,
        pages: job.chunks.map((chunk) => chunk.page),
        texts: job.chunks.map((chunk) => chunk.text),
        dims: rows.dims,
        values: rows.values,
        scales: rows.scales,
      },
    )
    job.saved = true
    embedded++
  }

  // Sources without a passage are recorded too, so they don't come up again.
  for (const job of jobs) if (job.chunks.length === 0) await save(job)
  // Small batches on this device, so progress moves; providers take more.
  const size = target.local ? 32 : 64
  for (let start = 0; start < queue.length; start += size) {
    if (signal.aborted) break
    const batch = queue.slice(start, start + size)
    const vectors = await ai.embed(
      batch.map((item) => item.text),
      { signal },
    )
    batch.forEach((item, index) => {
      item.job.vectors[item.row] = vectors[index]
    })
    // Each source is saved as soon as all its passages are done.
    for (const job of new Set(batch.map((item) => item.job)))
      if (
        !job.saved &&
        job.vectors.filter(Boolean).length === job.chunks.length
      )
        await save(job)
    done += batch.length
    tokens += estimateTokens(
      batch.reduce((sum, item) => sum + item.text.length, 0),
    )
    indexStatusStore.set({
      state: 'running',
      done,
      total,
      auto: Boolean(options.auto),
    })
  }
  return { embedded, passages: done, removed: plan.remove.length, tokens }
}

/**
 * Brings the index up to date: deletes what's gone, and embeds what's new
 * or changed with the model in Settings. One update runs at a time (across
 * tabs, too); a requested one waits for the one before it.
 */
export async function updateIndex(
  options: UpdateOptions = {},
): Promise<UpdateResult> {
  if (options.auto && current) return NOTHING
  while (current) await current.catch(() => {})
  const work = () => {
    const stop = new AbortController()
    controller = stop
    return run(options, stop.signal).then(
      (result) => {
        indexStatusStore.set({ state: 'idle' })
        return result
      },
      (error: unknown) => {
        const aborted =
          stop.signal.aborted || (isAiError(error) && error.kind === 'aborted')
        indexStatusStore.set(
          aborted
            ? { state: 'idle' }
            : { state: 'error', message: describeAiError(error) },
        )
        if (!aborted) throw error
        return NOTHING
      },
    )
  }
  const locks = typeof navigator === 'undefined' ? undefined : navigator.locks
  const promise: Promise<UpdateResult> = locks
    ? locks.request(
        'momentum-embeddings',
        { ifAvailable: Boolean(options.auto) },
        (lock) => (lock ? work() : NOTHING),
      )
    : work()
  current = promise
  try {
    return await promise
  } finally {
    if (current === promise) current = null
  }
}

let stopAuto: (() => void) | null = null

/**
 * Keeps the index up to date while Momentum is open, once search by meaning
 * has been used: with the model on this device, new and changed notes and
 * documents are indexed by themselves. With a provider, nothing is sent
 * without asking; only what's gone is taken out.
 */
export function startAutoIndex(): void {
  if (stopAuto) return
  let timer: ReturnType<typeof setTimeout> | undefined
  const schedule = (delay: number) => {
    clearTimeout(timer)
    timer = setTimeout(() => void autoUpdate(), delay)
  }
  const stopSources = onSourcesChange(() => schedule(4000))
  const stopSettings = aiSettingsStore.subscribe(() => schedule(1000))
  stopAuto = () => {
    clearTimeout(timer)
    stopSources()
    stopSettings()
  }
  schedule(500)
}

async function autoUpdate(): Promise<void> {
  // A change made while an update runs is picked up once it's done.
  while (current) await current.catch(() => {})
  const target = currentTarget()
  if (!target) return
  let ready = !target.local
  if (target.local) {
    await checkLocalModel(target.model)
    const { status } = localModelStore.get()
    // Never starts a download: that's for you to choose in Settings.
    ready = status === 'stored' || status === 'ready'
  }
  await updateIndex({
    auto: true,
    removalsOnly: !target.local || !ready,
  }).catch(() => {})
}
