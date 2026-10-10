import type { Background, UserPhoto } from './types'

/**
 * Every image in `src/assets/backgrounds/` becomes a built-in background
 * (glob patterns must be literal strings for Vite).
 * The name comes from the file name: `australia-mountains.jpg` → "Australia Mountains".
 */
const bundledPhotoUrls = import.meta.glob<string>(
  '../../assets/backgrounds/*.{jpg,jpeg,png,webp,avif}',
  { eager: true, query: '?url', import: 'default' },
)

/** Photos in `src/assets/backgrounds/unlocks/<days>/` unlock at that longest streak. */
const rewardPhotoUrls = import.meta.glob<string>(
  '../../assets/backgrounds/unlocks/*/*.{jpg,jpeg,png,webp,avif}',
  { eager: true, query: '?url', import: 'default' },
)

function fileName(path: string): string {
  return (path.split('/').pop() ?? path).replace(/\.[^.]+$/, '')
}

function nameFromPath(path: string): string {
  return fileName(path)
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function bundled(urls: Record<string, string>): Background[] {
  return Object.entries(urls)
    .sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }))
    .map(([path, src]) => {
      const unlockAt = Number(/\/unlocks\/(\d+)\//.exec(path)?.[1])
      return {
        id: `photo:${fileName(path).toLowerCase()}`,
        name: nameFromPath(path),
        kind: 'photo',
        src,
        ...(unlockAt > 0 ? { unlockAt } : {}),
      }
    })
}

export const BUNDLED_PHOTOS = bundled({
  ...bundledPhotoUrls,
  ...rewardPhotoUrls,
})

export const PRESETS: Background[] = [
  { id: 'alpine-dusk', name: 'Alpine Ridge', kind: 'scene', scene: 'alpine' },
  {
    id: 'midnight',
    name: 'Midnight',
    kind: 'gradient',
    layers: [
      {
        type: 'radial',
        at: [50, 0],
        size: [120, 80],
        stops: [
          ['#1d2a52', 0],
          ['#0b1022', 55],
          ['#05070f', 100],
        ],
      },
    ],
  },
  {
    id: 'aurora',
    name: 'Lagoon',
    kind: 'gradient',
    layers: [
      {
        type: 'radial',
        at: [20, 20],
        size: [60, 50],
        stops: [
          ['rgba(45,212,191,0.45)', 0],
          ['rgba(45,212,191,0)', 70],
        ],
      },
      {
        type: 'radial',
        at: [80, 30],
        size: [50, 45],
        stops: [
          ['rgba(129,140,248,0.45)', 0],
          ['rgba(129,140,248,0)', 70],
        ],
      },
      {
        type: 'radial',
        at: [50, 100],
        size: [70, 60],
        stops: [
          ['rgba(16,185,129,0.25)', 0],
          ['rgba(16,185,129,0)', 70],
        ],
      },
      {
        type: 'linear',
        stops: [
          ['#071a24', 0],
          ['#050b14', 100],
        ],
      },
    ],
  },
  {
    id: 'ember',
    name: 'Ember',
    kind: 'gradient',
    layers: [
      {
        type: 'radial',
        at: [50, 110],
        size: [70, 55],
        stops: [
          ['rgba(249,115,22,0.55)', 0],
          ['rgba(249,115,22,0)', 70],
        ],
      },
      {
        type: 'radial',
        at: [85, 15],
        size: [45, 40],
        stops: [
          ['rgba(244,63,94,0.3)', 0],
          ['rgba(244,63,94,0)', 70],
        ],
      },
      {
        type: 'linear',
        stops: [
          ['#120a10', 0],
          ['#1c0d08', 100],
        ],
      },
    ],
  },
  {
    id: 'graphite',
    name: 'Graphite',
    kind: 'gradient',
    layers: [
      {
        type: 'radial',
        at: [50, 0],
        size: [100, 70],
        stops: [
          ['#2a2d34', 0],
          ['#131418', 60],
          ['#0a0a0c', 100],
        ],
      },
    ],
  },
]

/** Milestones you can attach to your own reward photos. */
export const REWARD_MILESTONES = [30, 60, 100] as const

/** Built-in rewards: the mountain at its most beautiful, earned with a long streak. */
export const REWARD_SCENES: Background[] = [
  {
    id: 'scene:aurora',
    name: 'Aurora Ridge',
    kind: 'scene',
    scene: 'aurora',
    unlockAt: 30,
  },
  {
    id: 'scene:moonrise',
    name: 'Moonrise',
    kind: 'scene',
    scene: 'moonrise',
    unlockAt: 60,
  },
  {
    id: 'scene:first-light',
    name: 'First Light',
    kind: 'scene',
    scene: 'first-light',
    unlockAt: 100,
  },
]

/** Your own bundled photo wins as the default; otherwise the mountain scene. */
export const DEFAULT_BACKGROUND_ID =
  BUNDLED_PHOTOS.find((photo) => !photo.unlockAt)?.id ?? 'alpine-dusk'

export function userPhotoBackground(photo: UserPhoto): Background {
  return {
    id: `user:${photo.id}`,
    name: photo.name,
    kind: 'user-photo',
    photoId: photo.id,
    ...(photo.unlockAt ? { unlockAt: photo.unlockAt } : {}),
  }
}

export function isUnlocked(
  background: Background,
  longestStreak: number,
): boolean {
  return !background.unlockAt || longestStreak >= background.unlockAt
}

/** Every background, rewards last and in unlock order. */
export function listBackgrounds(photos: readonly UserPhoto[]): Background[] {
  const all = [
    ...BUNDLED_PHOTOS,
    ...photos.map(userPhotoBackground),
    ...PRESETS,
    ...REWARD_SCENES,
  ]
  const everyday = all.filter((background) => !background.unlockAt)
  const rewards = all
    .filter((background) => background.unlockAt)
    .sort((a, b) => (a.unlockAt ?? 0) - (b.unlockAt ?? 0))
  return [...everyday, ...rewards]
}

/** Resolves the selected id, falling back to the default if it's gone or still locked. */
export function resolveBackground(
  id: string | null,
  photos: readonly UserPhoto[],
  longestStreak: number,
): Background {
  const all = listBackgrounds(photos)
  const selected = all.find((background) => background.id === id)
  if (selected && isUnlocked(selected, longestStreak)) return selected
  return (
    all.find((background) => background.id === DEFAULT_BACKGROUND_ID) ??
    PRESETS[0]
  )
}
