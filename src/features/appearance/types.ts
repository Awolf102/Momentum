export type ThemeMode = 'dark' | 'light'

/** A photo the user uploaded; the image itself lives in IndexedDB. */
export interface UserPhoto {
  id: string
  name: string
  addedAt: string
}

export interface AppearanceSettings {
  theme: ThemeMode
  /** Selected background, or `null` for the default. */
  backgroundId: string | null
  /** Strength of the readability overlay, 0–0.8. */
  overlay: number
  photos: UserPhoto[]
}

export type Background =
  | { id: string; name: string; kind: 'scene'; scene: 'alpine-dusk' }
  | { id: string; name: string; kind: 'gradient'; css: string }
  | { id: string; name: string; kind: 'photo'; src: string }
  | { id: string; name: string; kind: 'user-photo'; photoId: string }
