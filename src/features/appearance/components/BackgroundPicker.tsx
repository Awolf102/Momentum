import { useRef, useState, type ChangeEvent } from 'react'
import {
  CheckIcon,
  LockIcon,
  PlusIcon,
  SparkleIcon,
  TrashIcon,
} from '@/components/icons'
import { SegmentedControl } from '@/components/SegmentedControl'
import { cn } from '@/lib/cn'
import { useProgress } from '@/lib/progress'
import { useStore } from '@/lib/store'
import { isUnlocked, listBackgrounds, REWARD_MILESTONES } from '../backgrounds'
import { useCurrentBackground, useLight } from '../hooks/useBackground'
import { addPhoto, appearanceStore, removePhoto, setBackground } from '../store'
import type { Background } from '../types'
import { BackgroundVisual } from './BackgroundVisual'

export function BackgroundPicker() {
  const { photos } = useStore(appearanceStore)
  const { longest } = useProgress()
  const selected = useCurrentBackground()
  const light = useLight()
  const all = listBackgrounds(photos)
  const available = all.filter((background) => isUnlocked(background, longest))
  const locked = all.filter((background) => !isUnlocked(background, longest))

  const fileInput = useRef<HTMLInputElement>(null)
  const uploadAs = useRef<{ unlockAt?: number }>({})
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [addingReward, setAddingReward] = useState(false)
  const [milestone, setMilestone] = useState<string>('30')

  function choosePhoto(options: { unlockAt?: number }) {
    uploadAs.current = options
    fileInput.current?.click()
  }

  async function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setError(null)
    setUploading(true)
    try {
      await addPhoto(file, uploadAs.current)
      setAddingReward(false)
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : 'Could not add that photo.',
      )
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div
        role="radiogroup"
        aria-label="Background"
        className="grid grid-cols-3 gap-2.5"
      >
        {available.map((background) => (
          <BackgroundTile
            key={background.id}
            background={background}
            selected={background.id === selected.id}
            light={background.id === selected.id ? light : undefined}
          />
        ))}
        <button
          type="button"
          onClick={() => choosePhoto({})}
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
      </div>

      <div>
        <h4 className="flex items-center gap-2 text-sm font-medium">
          <SparkleIcon className="text-orange-300 light:text-orange-500" />
          Rewards
        </h4>
        <p className="mt-0.5 text-xs text-fg-subtle">
          Backgrounds that unlock as your longest streak grows. Yours: {longest}{' '}
          {longest === 1 ? 'day' : 'days'}.
        </p>
        <div className="mt-3 grid grid-cols-3 gap-2.5">
          {locked.map((background) => (
            <LockedTile
              key={background.id}
              background={background}
              longest={longest}
            />
          ))}
          <button
            type="button"
            onClick={() => setAddingReward((open) => !open)}
            aria-expanded={addingReward}
            className="flex aspect-[4/3] w-full flex-col items-center justify-center gap-1 rounded-2xl border border-dashed border-fg-subtle/40 px-2 text-center text-xs font-medium text-fg-muted transition hover:border-fg-subtle hover:bg-tint"
          >
            <PlusIcon className="text-lg" />
            Reward photo
          </button>
        </div>
        {addingReward && (
          <div className="mt-3 space-y-3 rounded-2xl bg-tint p-4">
            <p className="text-sm">
              Save a travel photo for later. It stays hidden until your longest
              streak reaches:
            </p>
            <SegmentedControl
              label="Unlocks at"
              value={milestone}
              options={REWARD_MILESTONES.map((days) => ({
                value: String(days),
                label: `${days} days`,
              }))}
              onChange={setMilestone}
            />
            <button
              type="button"
              disabled={uploading}
              onClick={() => choosePhoto({ unlockAt: Number(milestone) })}
              className="w-full rounded-full bg-linear-to-br from-amber-300 to-orange-500 px-4 py-2.5 text-sm font-semibold text-orange-950 disabled:opacity-60"
            >
              {uploading ? 'Adding…' : 'Choose photo'}
            </button>
          </div>
        )}
      </div>

      <input
        ref={fileInput}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(event) => void handleFile(event)}
      />
      {error && (
        <p role="alert" className="text-sm text-rose-300 light:text-rose-600">
          {error}
        </p>
      )}
    </div>
  )
}

function TileLabel({ children }: { children: string }) {
  return (
    <span className="absolute inset-x-0 bottom-0 bg-linear-to-t from-black/70 to-transparent px-2 pt-5 pb-1.5 text-left text-[11px] font-medium text-white">
      <span className="line-clamp-1">{children}</span>
    </span>
  )
}

function BackgroundTile({
  background,
  selected,
  light,
}: {
  background: Background
  selected: boolean
  light?: ReturnType<typeof useLight>
}) {
  return (
    <div className="group relative">
      <button
        type="button"
        role="radio"
        aria-checked={selected}
        onClick={() => setBackground(background.id)}
        className={cn(
          'relative block aspect-[4/3] w-full overflow-hidden rounded-2xl ring-2 ring-offset-0 transition',
          selected ? 'ring-orange-300' : 'ring-transparent hover:ring-line',
        )}
      >
        <BackgroundVisual background={background} light={light} thumbnail />
        <TileLabel>{background.name}</TileLabel>
        {selected && (
          <span className="absolute top-1.5 right-1.5 flex size-5 items-center justify-center rounded-full bg-orange-300 text-xs text-orange-950">
            <CheckIcon strokeWidth={2.5} />
          </span>
        )}
        {background.unlockAt && !selected && (
          <span
            title={`Earned with a ${background.unlockAt}-day streak`}
            className="absolute top-1.5 right-1.5 flex size-5 items-center justify-center rounded-full bg-black/50 text-[11px] text-amber-200 backdrop-blur"
          >
            <SparkleIcon />
          </span>
        )}
      </button>
      {background.kind === 'user-photo' && (
        <RemoveButton photoId={background.photoId} name={background.name} />
      )}
    </div>
  )
}

function LockedTile({
  background,
  longest,
}: {
  background: Background
  longest: number
}) {
  const target = background.unlockAt ?? 0
  const progress = Math.min(1, longest / target)
  return (
    <div className="group relative">
      <div
        role="img"
        aria-label={`${background.name}: unlocks at a ${target}-day streak (${longest} of ${target})`}
        className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl"
      >
        <div className="absolute inset-0 scale-125 blur-md">
          <BackgroundVisual background={background} thumbnail />
        </div>
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-0.5 bg-black/45 text-white">
          <LockIcon className="text-base opacity-90" />
          <span className="text-[11px] font-semibold">{target} days</span>
        </div>
        <span className="absolute inset-x-2 bottom-1.5 h-1 overflow-hidden rounded-full bg-white/20">
          <span
            className="block h-full rounded-full bg-orange-300"
            style={{ width: `${progress * 100}%` }}
          />
        </span>
      </div>
      {background.kind === 'user-photo' && (
        <RemoveButton photoId={background.photoId} name={background.name} />
      )}
    </div>
  )
}

function RemoveButton({ photoId, name }: { photoId: string; name: string }) {
  return (
    <button
      type="button"
      onClick={() => void removePhoto(photoId)}
      aria-label={`Remove ${name}`}
      title="Remove photo"
      className="absolute top-1.5 left-1.5 flex size-6 items-center justify-center rounded-full bg-black/55 text-sm text-white opacity-100 backdrop-blur transition hover:bg-black/75 sm:opacity-0 sm:group-focus-within:opacity-100 sm:group-hover:opacity-100"
    >
      <TrashIcon />
    </button>
  )
}
