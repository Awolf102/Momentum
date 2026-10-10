import { useEffect, useState } from 'react'
import { AlertIcon, LibraryIcon, NoteIcon, TrashIcon } from '@/components/icons'
import { SettingsCard } from '@/components/SettingsCard'
import {
  aiSettingsStore,
  checkLocalModel,
  downloadSize,
  formatMegabytes,
  formatTokenEstimate,
  localModelStore,
  modelStored,
  prepareLocalModel,
  SendPreview,
  useAiReadiness,
} from '@/features/ai'
import { useStore } from '@/lib/store'
import { toast } from '@/lib/toast'
import {
  cancelIndexing,
  indexOverview,
  indexStatusStore,
  startAutoIndex,
  updateIndex,
  type IndexOverview,
  type UpdateResult,
} from '../indexer'
import { estimateTokens } from '../lib/plan'
import { indexVersionStore } from '../search'
import { embeddingSettingsStore, setExcluded } from '../settings'
import { onSourcesChange } from '../sources'
import { clearIndex } from '../storage'
import type { Source } from '../types'

const plural = (count: number, one: string, many = `${one}s`) =>
  `${count.toLocaleString()} ${count === 1 ? one : many}`

/** "3 notes and 2 documents" */
function describeSources(sources: readonly Pick<Source, 'kind'>[]): string {
  const notes = sources.filter((source) => source.kind === 'note').length
  const documents = sources.length - notes
  return [
    notes ? plural(notes, 'note') : '',
    documents ? plural(documents, 'document') : '',
  ]
    .filter(Boolean)
    .join(' and ')
}

const button =
  'rounded-full bg-tint px-4 py-2 text-xs font-semibold transition hover:bg-line disabled:opacity-40'
const primary =
  'rounded-full bg-linear-to-br from-amber-300 to-orange-500 px-4 py-2 text-sm font-semibold text-orange-950 shadow-[0_10px_24px_-12px_rgb(249_115_22/0.8)] transition hover:shadow-[0_12px_28px_-10px_rgb(249_115_22/0.9)] active:scale-95 disabled:opacity-40'

function announce(result: UpdateResult) {
  if (result.embedded === 0) return
  toast({
    title: 'Search index updated',
    description: `Indexed ${describeCount(result.embedded)}: ${plural(result.passages, 'passage')}.`,
  })
}

const describeCount = (count: number) =>
  count === 1 ? '1 note or document' : `${count} notes and documents`

/**
 * Settings → AI → Search by meaning: what's indexed, what's waiting, and
 * (with a provider) choosing exactly what gets sent to index it.
 */
export function MeaningIndexCard() {
  const readiness = useAiReadiness('embeddings')
  const settings = useStore(aiSettingsStore)
  const status = useStore(indexStatusStore)
  const version = useStore(indexVersionStore)
  const { excluded } = useStore(embeddingSettingsStore)
  const model = useStore(localModelStore)
  const [overview, setOverview] = useState<IndexOverview | null>(null)
  const [changes, setChanges] = useState(0)
  // Each opening of the preview starts from the current choices.
  const [preview, setPreview] = useState({ open: false, key: 0 })
  const [confirmClear, setConfirmClear] = useState(false)
  const local = readiness.ready && readiness.provider === 'browser'

  // Kept current while the card is open.
  useEffect(() => {
    startAutoIndex()
    let timer: ReturnType<typeof setTimeout> | undefined
    const stop = onSourcesChange(() => {
      clearTimeout(timer)
      timer = setTimeout(() => setChanges((count) => count + 1), 500)
    })
    return () => {
      clearTimeout(timer)
      stop()
    }
  }, [])

  useEffect(() => {
    let current = true
    indexOverview().then(
      (next) => current && setOverview(next),
      () => {},
    )
    return () => {
      current = false
    }
  }, [settings, status.state, version, excluded, changes, model.status])

  const localModel = local ? readiness.model : ''
  useEffect(() => {
    if (localModel) void checkLocalModel(localModel)
  }, [localModel])

  useEffect(() => {
    if (!confirmClear) return
    const timer = setTimeout(() => setConfirmClear(false), 4000)
    return () => clearTimeout(timer)
  }, [confirmClear])

  const description =
    'Find notes and document pages by what they’re about, from ⌘K, even when they don’t share your words.'

  if (!readiness.ready || !overview)
    return (
      <SettingsCard title="Search by meaning" description={description}>
        <p className="text-sm text-fg-muted" role="status">
          {readiness.ready
            ? 'Checking the index…'
            : 'Choose where embeddings come from above to turn it on.'}
        </p>
      </SettingsCard>
    )

  const { indexed, pending, target } = overview
  const modelHere = modelStored(model)
  const running = status.state === 'running' ? status : null
  const waiting = describeSources(pending.map((item) => item.source))

  async function buildHere() {
    try {
      await prepareLocalModel(target.model)
      announce(await updateIndex())
    } catch {
      // The model field and the status line say what went wrong.
    }
  }

  return (
    <SettingsCard title="Search by meaning" description={description}>
      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-2 text-center">
          {(
            [
              ['Notes', indexed.notes],
              ['Documents', indexed.documents],
              ['Passages', indexed.passages],
            ] as const
          ).map(([label, value]) => (
            <div key={label} className="rounded-2xl bg-tint px-2 py-3">
              <p className="font-serif text-2xl leading-none tabular-nums">
                {value.toLocaleString()}
              </p>
              <p className="mt-1 text-xs text-fg-subtle">{label} indexed</p>
            </div>
          ))}
        </div>

        {running ? (
          <Progress
            done={running.done}
            total={running.total}
            onCancel={cancelIndexing}
          />
        ) : status.state === 'error' ? (
          <p className="flex items-start gap-1.5 text-xs text-rose-300 light:text-rose-600">
            <AlertIcon className="mt-px shrink-0" />
            {status.message}
          </p>
        ) : pending.length > 0 ? (
          <p className="text-sm text-fg-muted" role="status">
            {waiting} {pending.length === 1 ? 'isn’t' : 'aren’t'} indexed yet.
            {local && modelHere && ' This device indexes them by itself.'}
          </p>
        ) : (
          <p className="text-sm text-fg-muted" role="status">
            Everything is indexed.
          </p>
        )}

        {local && !modelHere && (
          <div className="space-y-2">
            <p className="text-xs leading-relaxed text-fg-subtle">
              The model ({formatMegabytes(downloadSize(target.model))}) is
              downloaded once. Then notes and documents are indexed and searched
              on this device, even offline: nothing is sent.
            </p>
            {model.status === 'downloading' ? (
              <p className="text-xs text-fg-muted" role="status">
                Downloading the model… {formatMegabytes(model.loaded)} of{' '}
                {formatMegabytes(model.total)}
              </p>
            ) : model.status === 'starting' ? (
              <p className="text-xs text-fg-muted" role="status">
                Starting the model…
              </p>
            ) : (
              <>
                {model.status === 'error' && (
                  <p className="flex items-start gap-1.5 text-xs text-rose-300 light:text-rose-600">
                    <AlertIcon className="mt-px shrink-0" />
                    Couldn’t download the model. Check your connection and try
                    again.
                  </p>
                )}
                <button
                  type="button"
                  onClick={() => void buildHere()}
                  className={primary}
                >
                  {model.status === 'error'
                    ? 'Try again'
                    : 'Download and build the index'}
                </button>
              </>
            )}
          </div>
        )}

        {local && modelHere && !running && pending.length > 0 && (
          <button
            type="button"
            onClick={() => void updateIndex().then(announce, () => {})}
            className={button}
          >
            {status.state === 'error' ? 'Try again' : 'Index now'}
          </button>
        )}

        {!local && (
          <div className="space-y-3">
            <p className="text-xs leading-relaxed text-fg-subtle">
              Indexing sends the text of notes and documents to {target.label}.
              Nothing is sent until you’ve seen what goes and pressed Send.
              Searching from ⌘K sends only what you search for, when you ask.
            </p>
            <button
              type="button"
              disabled={
                Boolean(running) ||
                (pending.length === 0 && overview.excluded.length === 0)
              }
              onClick={() =>
                setPreview((current) => ({ open: true, key: current.key + 1 }))
              }
              className={primary}
            >
              {pending.length > 0
                ? 'Review and index…'
                : 'Choose what’s indexed…'}
            </button>
          </div>
        )}

        {indexed.passages > 0 && !running && (
          <button
            type="button"
            onClick={() => {
              if (!confirmClear) return setConfirmClear(true)
              setConfirmClear(false)
              void clearIndex()
            }}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-rose-300 transition hover:text-rose-200 light:text-rose-600"
          >
            <TrashIcon />
            {confirmClear
              ? 'Tap again to delete the index'
              : 'Delete the index'}
          </button>
        )}
      </div>

      {!local && (
        <IndexPreview
          key={preview.key}
          open={preview.open}
          onClose={() => setPreview((current) => ({ ...current, open: false }))}
          overview={overview}
        />
      )}
    </SettingsCard>
  )
}

function Progress({
  done,
  total,
  onCancel,
}: {
  done: number
  total: number
  onCancel: () => void
}) {
  return (
    <div>
      <div
        role="progressbar"
        aria-label="Indexing"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={done}
        className="h-1.5 overflow-hidden rounded-full bg-line"
      >
        <div
          className="h-full rounded-full bg-orange-400 transition-[width]"
          style={{ width: `${Math.round((done / Math.max(1, total)) * 100)}%` }}
        />
      </div>
      <div className="mt-2 flex items-center justify-between gap-3">
        <p className="text-xs text-fg-subtle" role="status">
          Indexing… {done.toLocaleString()} of {plural(total, 'passage')}
        </p>
        <button type="button" onClick={onCancel} className={button}>
          Stop
        </button>
      </div>
    </div>
  )
}

/** Choosing what's sent to be indexed, and seeing how much it is. */
function IndexPreview({
  open,
  onClose,
  overview,
}: {
  open: boolean
  onClose: () => void
  overview: IndexOverview
}) {
  const { target, pending, excluded } = overview
  const items = [...pending, ...excluded]
  // What's unticked: to begin with, what's already kept out.
  const [skipped, setSkipped] = useState<ReadonlySet<string>>(
    () => new Set(excluded.map((item) => item.source.key)),
  )
  const sending = items.filter((item) => !skipped.has(item.source.key))
  const passages = sending.reduce((sum, item) => sum + item.passages, 0)
  const tokens = estimateTokens(
    sending.reduce((sum, item) => sum + item.chars, 0),
  )

  function send() {
    const keys = items.map((item) => item.source.key)
    setExcluded(
      keys.filter((key) => skipped.has(key)),
      true,
    )
    setExcluded(
      keys.filter((key) => !skipped.has(key)),
      false,
    )
    onClose()
    void updateIndex({
      only: new Set(sending.map((item) => item.source.key)),
    }).then(announce, () => {})
  }

  return (
    <SendPreview
      open={open}
      onClose={onClose}
      title="Index for search by meaning"
      purpose="The text of these notes and documents is sent to be turned into vectors, which are kept on this device. Untick anything you’d rather keep to yourself: it stays out of search by meaning (searching by its words still finds it)."
      provider={target.provider}
      model={target.model}
      items={items.map((item) => ({
        id: item.source.key,
        title: item.source.title,
        icon: item.source.kind === 'note' ? <NoteIcon /> : <LibraryIcon />,
        detail: `${plural(item.passages, 'passage')} · ${formatTokenEstimate(estimateTokens(item.chars))}`,
      }))}
      skipped={skipped}
      onToggle={(id, send) =>
        setSkipped((current) => {
          const next = new Set(current)
          if (send) next.delete(id)
          else next.add(id)
          return next
        })
      }
      tokens={tokens}
      sendLabel={
        passages > 0 ? `Send ${plural(passages, 'passage')}` : 'Save choices'
      }
      onSend={send}
    />
  )
}
