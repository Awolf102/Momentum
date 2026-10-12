import { useEffect } from 'react'
import { AlertIcon, CheckIcon } from '@/components/icons'
import { cn } from '@/lib/cn'
import { useStore } from '@/lib/store'
import { formatSize } from '../lib/format'
import { localChat } from '../local/chatDevice'
import {
  LOCAL_CHAT_MODELS,
  type LocalChatModel,
  type Precision,
} from '../local/chatModels'
import { localChatStore, type ModelFiles } from '../local/chatState'
import { CHAT_IDLE_MS } from '../local/chat'
import { checkGpu, gpuStore, noGpuMessage } from '../local/webgpu'
import { setTaskModel } from '../store'

const button =
  'shrink-0 rounded-full bg-tint px-4 py-2 text-xs font-semibold transition hover:bg-line disabled:opacity-40'

/**
 * Chat on this device: whether this browser can run it (WebGPU), the
 * models with their sizes, and downloading or removing each. Nothing
 * downloads until you press Download.
 */
export function LocalChatField({ modelId }: { modelId: string }) {
  const gpu = useStore(gpuStore)
  const state = useStore(localChatStore)

  useEffect(() => {
    void checkGpu().then(() => localChat.refresh())
  }, [])

  if (gpu.status === 'missing')
    return (
      <p
        role="alert"
        className="flex items-start gap-1.5 rounded-2xl bg-tint px-4 py-3 text-sm leading-relaxed text-fg-muted"
      >
        <AlertIcon className="mt-0.5 shrink-0 text-amber-300 light:text-amber-600" />
        {noGpuMessage(gpu.reason)}
      </p>
    )
  const precision: Precision =
    gpu.status === 'available' ? gpu.precision : 'f16'
  const running = state.running
  const chosen = state.files[modelId]
  const problem = state.problem

  return (
    <div>
      <p className="text-sm font-medium">Model</p>
      <p className="mt-0.5 text-xs leading-relaxed text-fg-subtle">
        Downloaded once from Hugging Face (with the code that runs it, from
        GitHub), then it runs on this device’s graphics processor, even offline.
        Nothing you ask is sent anywhere.
      </p>
      <ul className="mt-3 space-y-2" aria-label="Models on this device">
        {LOCAL_CHAT_MODELS.map((model) => (
          <ModelRow
            key={model.id}
            model={model}
            precision={precision}
            files={state.files[model.id] ?? { status: 'unknown' }}
            chosen={model.id === modelId}
            download={
              state.download?.model === model.id ? state.download : null
            }
            busy={state.download !== null}
            ready={gpu.status === 'available'}
            room={
              state.storage && state.storage.quota > 0
                ? state.storage.quota - state.storage.usage
                : null
            }
          />
        ))}
      </ul>
      <p
        role="status"
        className={cn(
          'mt-2 text-xs leading-relaxed',
          problem?.model === modelId
            ? 'text-rose-300 light:text-rose-600'
            : 'text-fg-subtle',
        )}
      >
        {problem?.model === modelId ? (
          <span className="inline-flex items-start gap-1.5">
            <AlertIcon className="mt-px shrink-0" />
            {problem.message}
          </span>
        ) : running?.model === modelId ? (
          running.status === 'loading' ? (
            `Loading it onto the graphics processor… ${Math.round(running.fraction * 100)}%`
          ) : (
            <span className="inline-flex items-start gap-1.5 text-fg-muted">
              <CheckIcon className="mt-px shrink-0 text-orange-300 light:text-orange-500" />
              Loaded and ready. It’s unloaded after{' '}
              {Math.round(CHAT_IDLE_MS / 60_000)} minutes unused, to free the
              memory.
            </span>
          )
        ) : chosen?.status === 'stored' ? (
          <span className="inline-flex items-start gap-1.5 text-fg-muted">
            <CheckIcon className="mt-px shrink-0 text-orange-300 light:text-orange-500" />
            On this device. It loads the first time you use it, and is unloaded
            after {Math.round(CHAT_IDLE_MS / 60_000)} minutes unused.
          </span>
        ) : gpu.status === 'available' ? (
          'Download the chosen model to use it.'
        ) : (
          'Checking this browser can run it…'
        )}
      </p>
      <StorageLine />
    </div>
  )
}

function ModelRow({
  model,
  precision,
  files,
  chosen,
  download,
  busy,
  ready,
  room,
}: {
  model: LocalChatModel
  precision: Precision
  files: ModelFiles
  chosen: boolean
  download: { loaded: number; total: number; fraction: number } | null
  busy: boolean
  ready: boolean
  /** Bytes the browser will still let Momentum keep, when it says. */
  room: number | null
}) {
  const id = `local-chat-${model.id}`
  const start = () => void localChat.download(model.id)
  const remove = () => void localChat.remove(model.id)
  const here = files.status === 'stored' || files.status === 'partial'
  const needs =
    model.downloadBytes[precision] -
    (files.status === 'partial' ? files.bytes : 0)
  const cramped =
    files.status !== 'stored' && !download && room !== null && room < needs
  return (
    <li
      className={cn(
        'rounded-2xl bg-tint px-4 py-3 ring-orange-300/60 transition',
        chosen && 'ring-2',
      )}
    >
      <div className="flex items-start gap-3">
        <input
          id={id}
          type="radio"
          name="local-chat-model"
          checked={chosen}
          onChange={() => setTaskModel('chat', model.id, 'browser')}
          className="mt-1 size-4 shrink-0 accent-orange-400"
        />
        <label htmlFor={id} className="min-w-0 flex-1 cursor-pointer">
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
            {model.name}
            {model.recommended && (
              <span className="rounded-full bg-orange-400/20 px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap text-orange-200 light:text-orange-700">
                Recommended for 8 GB Macs
              </span>
            )}
          </span>
          <span className="mt-0.5 block text-xs text-fg-subtle">
            {files.status === 'stored'
              ? `${formatSize(files.bytes)} on this device`
              : files.status === 'partial'
                ? `Partly downloaded: ${formatSize(files.bytes)} (${Math.round(files.weightFraction * 100)}%)`
                : `About ${formatSize(model.downloadBytes[precision])} to download`}{' '}
            · about {formatSize(model.memoryBytes[precision])} of memory to run
          </span>
          {cramped && (
            <span className="mt-1 flex items-start gap-1.5 text-xs text-amber-200 light:text-amber-700">
              <AlertIcon className="mt-px shrink-0" />
              There may not be room: the browser lets Momentum keep about{' '}
              {formatSize(Math.max(0, room!))} more.
            </span>
          )}
          {model.caution && (
            <span className="mt-1 flex items-start gap-1.5 text-xs text-amber-200 light:text-amber-700">
              <AlertIcon className="mt-px shrink-0" />
              {model.caution}
            </span>
          )}
        </label>
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          {download ? (
            <button
              type="button"
              onClick={() => void localChat.cancelDownload()}
              className={button}
            >
              Cancel
            </button>
          ) : files.status === 'stored' ? (
            <button type="button" onClick={remove} className={button}>
              Remove
            </button>
          ) : (
            <button
              type="button"
              onClick={start}
              disabled={busy || !ready}
              className={button}
            >
              {files.status === 'partial' ? 'Resume' : 'Download'}
            </button>
          )}
          {files.status === 'partial' && !download && (
            <button
              type="button"
              onClick={remove}
              className="px-2 text-xs font-medium text-fg-subtle hover:text-fg"
            >
              Remove
            </button>
          )}
        </div>
      </div>
      {download && (
        <div className="mt-3">
          <div
            role="progressbar"
            aria-label={`Downloading ${model.name}`}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(download.fraction * 100)}
            className="h-1.5 overflow-hidden rounded-full bg-line"
          >
            <div
              className="h-full rounded-full bg-orange-400 transition-[width]"
              style={{ width: `${Math.round(download.fraction * 100)}%` }}
            />
          </div>
          <p className="mt-1.5 text-xs text-fg-subtle">
            Downloading… {formatSize(download.loaded)} of about{' '}
            {formatSize(download.total)}. If it stops, it picks up where it left
            off.
          </p>
        </div>
      )}
      {here && files.status === 'partial' && !download && !busy && (
        <p className="mt-2 text-xs text-fg-subtle">
          The download stopped part way. Resume picks up where it left off.
        </p>
      )}
    </li>
  )
}

/** Whether the browser will keep the model, and how much room there is. */
function StorageLine() {
  const { persisted, storage } = useStore(localChatStore)
  if (persisted === null && !storage) return null
  return (
    <p className="mt-2 text-xs leading-relaxed text-fg-subtle">
      {persisted
        ? 'The browser has agreed to keep what Momentum stores, so it won’t clear the model to make room.'
        : 'The browser may clear the model if space runs low; it asks to keep it when you download one.'}
      {storage && storage.quota > 0 && storage.usage >= 1_000_000
        ? ` Momentum uses ${formatSize(storage.usage)} of the ${formatSize(storage.quota)} it may use here.`
        : ''}
    </p>
  )
}
