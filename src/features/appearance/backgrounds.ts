import type { Background, UserPhoto } from './types'

/**
 * Every image in `src/assets/backgrounds/` becomes a built-in background.
 * The name comes from the file name: `australia-mountains.jpg` → "Australia Mountains".
 */
const bundledPhotoUrls = import.meta.glob<string>(
  '../../assets/backgrounds/*.{jpg,jpeg,png,webp,avif}',
  { eager: true, query: '?url', import: 'default' },
)

function nameFromPath(path: string): string {
  const fileName = path.split('/').pop() ?? path
  return fileName
    .replace(/\.[^.]+$/, '')
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function slugFromPath(path: string): string {
  return (path.split('/').pop() ?? path).replace(/\.[^.]+$/, '').toLowerCase()
}

export const BUNDLED_PHOTOS: Background[] = Object.entries(bundledPhotoUrls)
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([path, src]) => ({
    id: `photo:${slugFromPath(path)}`,
    name: nameFromPath(path),
    kind: 'photo',
    src,
  }))

export const PRESETS: Background[] = [
  {
    id: 'alpine-dusk',
    name: 'Alpine Dusk',
    kind: 'scene',
    scene: 'alpine-dusk',
  },
  {
    id: 'midnight',
    name: 'Midnight',
    kind: 'gradient',
    css: 'radial-gradient(120% 80% at 50% 0%, #1d2a52 0%, #0b1022 55%, #05070f 100%)',
  },
  {
    id: 'aurora',
    name: 'Aurora',
    kind: 'gradient',
    css: [
      'radial-gradient(60% 50% at 20% 20%, rgb(45 212 191 / 0.45) 0%, transparent 70%)',
      'radial-gradient(50% 45% at 80% 30%, rgb(129 140 248 / 0.45) 0%, transparent 70%)',
      'radial-gradient(70% 60% at 50% 100%, rgb(16 185 129 / 0.25) 0%, transparent 70%)',
      'linear-gradient(180deg, #071a24 0%, #050b14 100%)',
    ].join(', '),
  },
  {
    id: 'ember',
    name: 'Ember',
    kind: 'gradient',
    css: [
      'radial-gradient(70% 55% at 50% 110%, rgb(249 115 22 / 0.55) 0%, transparent 70%)',
      'radial-gradient(45% 40% at 85% 15%, rgb(244 63 94 / 0.3) 0%, transparent 70%)',
      'linear-gradient(180deg, #120a10 0%, #1c0d08 100%)',
    ].join(', '),
  },
  {
    id: 'graphite',
    name: 'Graphite',
    kind: 'gradient',
    css: 'radial-gradient(100% 70% at 50% 0%, #2a2d34 0%, #131418 60%, #0a0a0c 100%)',
  },
]

/** Your own bundled photo wins as the default; otherwise the mountain scene. */
export const DEFAULT_BACKGROUND_ID = BUNDLED_PHOTOS[0]?.id ?? 'alpine-dusk'

export function userPhotoBackground(photo: UserPhoto): Background {
  return {
    id: `user:${photo.id}`,
    name: photo.name,
    kind: 'user-photo',
    photoId: photo.id,
  }
}

/** All backgrounds the picker offers, in display order. */
export function listBackgrounds(photos: readonly UserPhoto[]): Background[] {
  return [...BUNDLED_PHOTOS, ...photos.map(userPhotoBackground), ...PRESETS]
}

/** Resolves the selected id, falling back to the default if it no longer exists. */
export function resolveBackground(
  id: string | null,
  photos: readonly UserPhoto[],
): Background {
  const all = listBackgrounds(photos)
  return (
    all.find((background) => background.id === id) ??
    all.find((background) => background.id === DEFAULT_BACKGROUND_ID) ??
    PRESETS[0]
  )
}
