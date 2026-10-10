import type { GradientLayer } from './lib/gradients'
import type { LightMode } from './lib/light'
import type { SceneId } from './scenes'

export type ThemeMode = 'dark' | 'light'

/** A photo the user uploaded; the image itself lives in IndexedDB. */
export interface UserPhoto {
  id: string
  name: string
  addedAt: string
  /** Set for reward photos: the longest streak that unlocks it. */
  unlockAt?: number
}

export interface AppearanceSettings {
  theme: ThemeMode
  /** Selected background, or `null` for the default. */
  backgroundId: string | null
  /** Strength of the readability overlay, 0–0.8. */
  overlay: number
  light: LightMode
  photos: UserPhoto[]
  /** Rewards whose unlock has already been celebrated. */
  celebrated: string[]
}

interface BackgroundBase {
  id: string
  name: string
  /** Rewards: the longest streak needed to unlock this background. */
  unlockAt?: number
}

export type Background = BackgroundBase &
  (
    | { kind: 'scene'; scene: SceneId }
    | { kind: 'gradient'; layers: readonly GradientLayer[] }
    | { kind: 'photo'; src: string }
    | { kind: 'user-photo'; photoId: string }
  )
