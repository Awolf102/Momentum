import { isRecord } from '@/lib/guards'
import { createId } from '@/lib/id'
import { createPersistentStore } from '@/lib/persistentStore'
import { userPhotoBackground } from './backgrounds'
import type { LightMode } from './lib/light'
import { deletePhoto, savePhoto } from './lib/photoStorage'
import { processPhoto } from './lib/processPhoto'
import type { AppearanceSettings, ThemeMode, UserPhoto } from './types'

export const MAX_OVERLAY = 0.8

const DEFAULT_APPEARANCE: AppearanceSettings = {
  theme: 'dark',
  backgroundId: null,
  overlay: 0.3,
  light: 'time',
  photos: [],
  celebrated: [],
}

const LIGHT_MODES: readonly LightMode[] = ['time', 'streak', 'off']

function parsePhoto(photo: unknown): UserPhoto | null {
  if (
    !isRecord(photo) ||
    typeof photo.id !== 'string' ||
    typeof photo.name !== 'string' ||
    typeof photo.addedAt !== 'string'
  ) {
    return null
  }
  const unlockAt =
    typeof photo.unlockAt === 'number' && photo.unlockAt > 0
      ? { unlockAt: Math.round(photo.unlockAt) }
      : {}
  return { id: photo.id, name: photo.name, addedAt: photo.addedAt, ...unlockAt }
}

/**
 * Fields added after the first release (light, celebrated, unlockAt) are
 * optional here and filled with defaults, so older saved settings still load.
 */
function parseAppearance(data: unknown): AppearanceSettings | null {
  if (!isRecord(data)) return null
  return {
    theme: data.theme === 'light' ? 'light' : 'dark',
    backgroundId:
      typeof data.backgroundId === 'string' ? data.backgroundId : null,
    overlay:
      typeof data.overlay === 'number'
        ? Math.min(MAX_OVERLAY, Math.max(0, data.overlay))
        : DEFAULT_APPEARANCE.overlay,
    light: LIGHT_MODES.includes(data.light as LightMode)
      ? (data.light as LightMode)
      : DEFAULT_APPEARANCE.light,
    photos: Array.isArray(data.photos)
      ? data.photos.map(parsePhoto).filter((photo) => photo !== null)
      : [],
    celebrated: Array.isArray(data.celebrated)
      ? data.celebrated.filter((id) => typeof id === 'string')
      : [],
  }
}

export const appearanceStore = createPersistentStore<AppearanceSettings>({
  key: 'momentum.appearance',
  version: 1,
  defaultValue: DEFAULT_APPEARANCE,
  parse: parseAppearance,
})

export function setTheme(theme: ThemeMode): void {
  appearanceStore.set((previous) => ({ ...previous, theme }))
}

export function toggleTheme(): void {
  appearanceStore.set((previous) => ({
    ...previous,
    theme: previous.theme === 'dark' ? 'light' : 'dark',
  }))
}

export function setBackground(backgroundId: string): void {
  appearanceStore.set((previous) => ({ ...previous, backgroundId }))
}

export function setOverlay(overlay: number): void {
  appearanceStore.set((previous) => ({
    ...previous,
    overlay: Math.min(MAX_OVERLAY, Math.max(0, overlay)),
  }))
}

export function setLight(light: LightMode): void {
  appearanceStore.set((previous) => ({ ...previous, light }))
}

export function markCelebrated(ids: readonly string[]): void {
  if (ids.length === 0) return
  appearanceStore.set((previous) => ({
    ...previous,
    celebrated: [...new Set([...previous.celebrated, ...ids])],
  }))
}

/**
 * Resizes and stores an uploaded photo. Everyday photos are selected straight
 * away; reward photos (with `unlockAt`) stay hidden until they're earned.
 */
export async function addPhoto(
  file: File,
  options: { unlockAt?: number } = {},
): Promise<void> {
  const images = await processPhoto(file)
  const photo: UserPhoto = {
    id: createId(),
    name: file.name.replace(/\.[^.]+$/, '') || 'My photo',
    addedAt: new Date().toISOString(),
    ...(options.unlockAt ? { unlockAt: options.unlockAt } : {}),
  }
  await savePhoto(photo.id, images)
  appearanceStore.set((previous) => ({
    ...previous,
    photos: [...previous.photos, photo],
    backgroundId: photo.unlockAt
      ? previous.backgroundId
      : userPhotoBackground(photo).id,
  }))
}

export async function removePhoto(photoId: string): Promise<void> {
  appearanceStore.set((previous) => ({
    ...previous,
    photos: previous.photos.filter((photo) => photo.id !== photoId),
    backgroundId:
      previous.backgroundId === `user:${photoId}`
        ? null
        : previous.backgroundId,
  }))
  await deletePhoto(photoId)
}
