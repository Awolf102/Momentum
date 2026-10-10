import { createStore, del, get, setMany } from 'idb-keyval'

/**
 * Uploaded photos are stored as Blobs in IndexedDB — localStorage only holds
 * strings and is capped at a few megabytes.
 */
let database: ReturnType<typeof createStore> | undefined
const db = () => (database ??= createStore('momentum', 'photos'))

export type PhotoVariant = 'full' | 'thumb'

const keyFor = (id: string, variant: PhotoVariant) => `${id}:${variant}`

export async function savePhoto(
  id: string,
  images: Record<PhotoVariant, Blob>,
): Promise<void> {
  await setMany(
    [
      [keyFor(id, 'full'), images.full],
      [keyFor(id, 'thumb'), images.thumb],
    ],
    db(),
  )
}

export function loadPhoto(
  id: string,
  variant: PhotoVariant,
): Promise<Blob | undefined> {
  return get<Blob>(keyFor(id, variant), db())
}

export async function deletePhoto(id: string): Promise<void> {
  await Promise.all([
    del(keyFor(id, 'full'), db()),
    del(keyFor(id, 'thumb'), db()),
  ])
}
