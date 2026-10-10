import { getDb } from '@/lib/db/db'

/**
 * Uploaded photos are stored as Blobs in IndexedDB's `photos` object store —
 * localStorage only holds strings and is capped at a few megabytes.
 */
export type PhotoVariant = 'full' | 'thumb'

const keyFor = (id: string, variant: PhotoVariant) => `${id}:${variant}`

export async function savePhoto(
  id: string,
  images: Record<PhotoVariant, Blob>,
): Promise<void> {
  const db = await getDb()
  const tx = db.transaction('photos', 'readwrite')
  await Promise.all([
    tx.store.put(images.full, keyFor(id, 'full')),
    tx.store.put(images.thumb, keyFor(id, 'thumb')),
    tx.done,
  ])
}

export async function loadPhoto(
  id: string,
  variant: PhotoVariant,
): Promise<Blob | undefined> {
  return (await getDb()).get('photos', keyFor(id, variant))
}

export async function deletePhoto(id: string): Promise<void> {
  const db = await getDb()
  const tx = db.transaction('photos', 'readwrite')
  await Promise.all([
    tx.store.delete(keyFor(id, 'full')),
    tx.store.delete(keyFor(id, 'thumb')),
    tx.done,
  ])
}

/** Every stored photo blob, for backups. */
export async function listAllPhotos(): Promise<
  Array<{ key: string; blob: Blob }>
> {
  const db = await getDb()
  const tx = db.transaction('photos')
  const [keys, blobs] = await Promise.all([
    tx.store.getAllKeys(),
    tx.store.getAll(),
  ])
  return keys.map((key, index) => ({ key, blob: blobs[index] }))
}

/** Restores a photo blob from a backup (keys look like `<id>:full`). */
export async function putPhoto(key: string, blob: Blob): Promise<void> {
  await (await getDb()).put('photos', blob, key)
}
