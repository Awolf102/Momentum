import { useEffect } from 'react'
import { AlertIcon, CheckIcon } from '@/components/icons'
import { useStore } from '@/lib/store'
import { formatMegabytes } from '../lib/format'
import {
  checkLocalModel,
  downloadSize,
  localModelStore,
  modelStored,
  prepareLocalModel,
  removeLocalModel,
} from '../local/client'
import { findLocalModel, modelSource } from '../local/models'

const button =
  'shrink-0 rounded-full bg-tint px-4 py-2 text-xs font-semibold transition hover:bg-line disabled:opacity-40'

/**
 * The model that runs on this device: what it is, and downloading or
 * removing it. Nothing downloads until you press Download.
 */
export function LocalModelField({ modelId }: { modelId: string }) {
  const state = useStore(localModelStore)
  const model = findLocalModel(modelId)
  const size = formatMegabytes(downloadSize(modelId))

  useEffect(() => {
    void checkLocalModel(modelId)
  }, [modelId])

  if (!model) return null
  const download = () => void prepareLocalModel(modelId).catch(() => {})
  const stored = modelStored(state)

  return (
    <div>
      <p className="text-sm font-medium">Model</p>
      <div className="mt-1.5 rounded-2xl bg-tint px-4 py-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm">
              {model.name}{' '}
              <span className="font-mono text-xs text-fg-subtle">
                {model.id}
              </span>
            </p>
            <p className="mt-0.5 text-xs text-fg-subtle">
              {model.language} ·{' '}
              {stored ? `${size} on this device` : `${size} download, once`}
            </p>
          </div>
          {state.status === 'absent' && (
            <button type="button" onClick={download} className={button}>
              Download
            </button>
          )}
          {stored && state.status !== 'starting' && (
            <button
              type="button"
              onClick={() => void removeLocalModel()}
              className={button}
            >
              Remove
            </button>
          )}
          {state.status === 'downloading' && (
            <button
              type="button"
              onClick={() => void removeLocalModel()}
              className={button}
            >
              Cancel
            </button>
          )}
          {state.status === 'error' && !stored && (
            <button type="button" onClick={download} className={button}>
              Try again
            </button>
          )}
        </div>
        {state.status === 'downloading' && (
          <div className="mt-3">
            <div
              role="progressbar"
              aria-label="Downloading the model"
              aria-valuemin={0}
              aria-valuemax={state.total}
              aria-valuenow={state.loaded}
              className="h-1.5 overflow-hidden rounded-full bg-line"
            >
              <div
                className="h-full rounded-full bg-orange-400 transition-[width]"
                style={{
                  width: `${Math.round((state.loaded / Math.max(1, state.total)) * 100)}%`,
                }}
              />
            </div>
            <p className="mt-1.5 text-xs text-fg-subtle">
              Downloading… {formatMegabytes(state.loaded)} of{' '}
              {formatMegabytes(state.total)}
            </p>
          </div>
        )}
      </div>
      <p
        className={
          state.status === 'error'
            ? 'mt-1.5 text-xs text-rose-300 light:text-rose-600'
            : 'mt-1.5 text-xs leading-relaxed text-fg-subtle'
        }
        role="status"
      >
        {state.status === 'error' ? (
          <span className="inline-flex items-start gap-1.5">
            <AlertIcon className="mt-px shrink-0" />
            {stored
              ? state.message
              : "Couldn't download the model. Check your connection and try again."}
          </span>
        ) : stored ? (
          <span className="inline-flex items-start gap-1.5 text-fg-muted">
            <CheckIcon className="mt-px shrink-0 text-orange-300 light:text-orange-500" />
            On this device. Everything is embedded here, even offline: nothing
            is sent.
          </span>
        ) : state.status === 'starting' ? (
          'Starting the model…'
        ) : state.status === 'absent' ? (
          `Comes from ${modelSource()}. After that, everything is embedded on this device, even offline: nothing is sent.`
        ) : (
          ' '
        )}
      </p>
    </div>
  )
}
