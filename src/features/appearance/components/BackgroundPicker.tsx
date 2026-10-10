import { useRef, useState, type ChangeEvent } from 'react'
import { CheckIcon, PlusIcon, TrashIcon } from '@/components/icons'
import { cn } from '@/lib/cn'
import { useStore } from '@/lib/persistentStore'
import { listBackgrounds, resolveBackground } from '../backgrounds'
import { addPhoto, appearanceStore, removePhoto, setBackground } from '../store'
import { BackgroundVisual } from './BackgroundVisual'

export function BackgroundPicker() {
  const { backgroundId, photos } = useStore(appearanceStore)
  const selectedId = resolveBackground(backgroundId, photos).id
  const backgrounds = listBackgrounds(photos)
  const fileInput = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setError(null)
    setUploading(true)
    try {
      await addPhoto(file)
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : 'Could not add that photo.',
      )
    } finally {
      setUploading(false)
    }
  }

  return (
    <div>
      <div
        role="radiogroup"
        aria-label="Background"
        className="grid grid-cols-3 gap-2.5"
      >
        {backgrounds.map((background) => {
          const selected = background.id === selectedId
          return (
            <div key={background.id} className="group relative">
              <button
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => setBackground(background.id)}
                className={cn(
                  'relative block aspect-[4/3] w-full overflow-hidden rounded-2xl ring-2 ring-offset-0 transition',
                  selected
                    ? 'ring-orange-300'
                    : 'ring-transparent hover:ring-line',
                )}
              >
                <BackgroundVisual background={background} thumbnail />
                <span className="absolute inset-x-0 bottom-0 bg-linear-to-t from-black/70 to-transparent px-2 pt-5 pb-1.5 text-left text-[11px] font-medium text-white">
                  <span className="line-clamp-1">{background.name}</span>
                </span>
                {selected && (
                  <span className="absolute top-1.5 right-1.5 flex size-5 items-center justify-center rounded-full bg-orange-300 text-xs text-orange-950">
                    <CheckIcon strokeWidth={2.5} />
                  </span>
                )}
              </button>
              {background.kind === 'user-photo' && (
                <button
                  type="button"
                  onClick={() => void removePhoto(background.photoId)}
                  aria-label={`Remove ${background.name}`}
                  title="Remove photo"
                  className="absolute top-1.5 left-1.5 flex size-6 items-center justify-center rounded-full bg-black/55 text-sm text-white opacity-100 backdrop-blur transition hover:bg-black/75 sm:opacity-0 sm:group-focus-within:opacity-100 sm:group-hover:opacity-100"
                >
                  <TrashIcon />
                </button>
              )}
            </div>
          )
        })}

        <button
          type="button"
          onClick={() => fileInput.current?.click()}
          disabled={uploading}
          className="flex aspect-[4/3] w-full flex-col items-center justify-center gap-1 rounded-2xl border border-dashed border-fg-subtle/40 text-xs font-medium text-fg-muted transition hover:border-fg-subtle hover:bg-tint disabled:opacity-60"
        >
          {uploading ? (
            <span className="size-4 animate-spin rounded-full border-2 border-fg-subtle border-t-transparent" />
          ) : (
            <PlusIcon className="text-lg" />
          )}
          {uploading ? 'Adding…' : 'Your photo'}
        </button>
        <input
          ref={fileInput}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(event) => void handleFile(event)}
        />
      </div>
      {error && (
        <p
          role="alert"
          className="mt-3 text-sm text-rose-300 light:text-rose-600"
        >
          {error}
        </p>
      )}
    </div>
  )
}
