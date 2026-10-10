import { isRecord } from '@/lib/guards'
import { createId } from '@/lib/id'
import { createPersistentStore } from '@/lib/persistentStore'
import { deletePhoto, savePhoto } from './lib/photoStorage'
import { processPhoto } from './lib/processPhoto'
import { userPhotoBackground } from './backgrounds'
import type { AppearanceSettings, ThemeMode, UserPhoto } from './types'

export const MAX_OVERLAY = 0.8

const DEFAULT_APPEARANCE: AppearanceSettings = {
  theme: 'dark',
  backgroundId: null,
  overlay: 0.3,
  photos: [],
}

function parseAppearance(data: unknown): AppearanceSettings | null {
  if (!isRecord(data)) return null
  const photos = Array.isArray(data.photos)
    ? data.photos.filter(
        (photo): photo is UserPhoto =>
          isRecord(photo) &&
          typeof photo.id === 'string' &&
          typeof photo.name === 'string' &&
          typeof photo.addedAt === 'string',
      )
    : []
  return {
    theme: data.theme === 'light' ? 'light' : 'dark',
    backgroundId:
      typeof data.backgroundId === 'string' ? data.backgroundId : null,
    overlay:
      typeof data.overlay === 'number'
        ? Math.min(MAX_OVERLAY, Math.max(0, data.overlay))
        : DEFAULT_APPEARANCE.overlay,
    photos,
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

export function setBackground(backgroundId: string): void {
  appearanceStore.set((previous) => ({ ...previous, backgroundId }))
}

export function setOverlay(overlay: number): void {
  appearanceStore.set((previous) => ({
    ...previous,
    overlay: Math.min(MAX_OVERLAY, Math.max(0, overlay)),
  }))
}

/** Resizes, stores and selects an uploaded photo. */
export async function addPhoto(file: File): Promise<void> {
  const images = await processPhoto(file)
  const photo: UserPhoto = {
    id: createId(),
    name: file.name.replace(/\.[^.]+$/, '') || 'My photo',
    addedAt: new Date().toISOString(),
  }
  await savePhoto(photo.id, images)
  appearanceStore.set((previous) => ({
    ...previous,
    photos: [...previous.photos, photo],
    backgroundId: userPhotoBackground(photo).id,
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
