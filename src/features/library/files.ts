import { getDb } from '@/lib/db/db'

/**
 * Each document's file, and a small picture of its first page, in the
 * `documentFiles` store: `<id>` and `<id>:thumb`. Kept out of the documents
 * collection so the library's records stay small enough to hold in memory.
 */
const thumbKey = (id: string) => `${id}:thumb`

export async function putFile(key: string, blob: Blob): Promise<void> {
  await (await getDb()).put('documentFiles', blob, key)
}

export async function loadFile(id: string): Promise<Blob | undefined> {
  return (await getDb()).get('documentFiles', id)
}

export const saveThumb = (id: string, blob: Blob) => putFile(thumbKey(id), blob)

export async function loadThumb(id: string): Promise<Blob | undefined> {
  return (await getDb()).get('documentFiles', thumbKey(id))
}

/** Every file and picture, for backups. */
export async function listAllFiles(): Promise<
  Array<{ key: string; blob: Blob }>
> {
  const db = await getDb()
  const tx = db.transaction('documentFiles')
  const [keys, blobs] = await Promise.all([
    tx.store.getAllKeys(),
    tx.store.getAll(),
  ])
  return keys.map((key, index) => ({ key, blob: blobs[index] }))
}

/** The documents that have files here (whatever their records say). */
export async function storedDocumentIds(): Promise<string[]> {
  const keys = await (await getDb()).getAllKeys('documentFiles')
  return keys.filter((key) => !key.endsWith(':thumb'))
}

/** Forgets a document's file, picture and text. */
export async function deleteFiles(id: string): Promise<void> {
  const db = await getDb()
  const tx = db.transaction(['documentFiles', 'documentTexts'], 'readwrite')
  await Promise.all([
    tx.objectStore('documentFiles').delete(id),
    tx.objectStore('documentFiles').delete(thumbKey(id)),
    tx.objectStore('documentTexts').delete(id),
    tx.done,
  ])
  texts?.delete(id)
  textsChanged()
}

export async function clearFiles(): Promise<void> {
  const db = await getDb()
  const tx = db.transaction(['documentFiles', 'documentTexts'], 'readwrite')
  await Promise.all([
    tx.objectStore('documentFiles').clear(),
    tx.objectStore('documentTexts').clear(),
    tx.done,
  ])
  texts?.clear()
  textsChanged()
}

// Each document's text (one string per page), for search. Read from the
// database once, when first needed, then kept up to date here.
let texts: Map<string, readonly string[]> | null = null
const textListeners = new Set<() => void>()

function textsChanged() {
  for (const listener of textListeners) listener()
}

/** Calls `listener` when a document's text is saved or deleted. */
export function onDocumentTextsChange(listener: () => void): () => void {
  textListeners.add(listener)
  return () => {
    textListeners.delete(listener)
  }
}
let loadingTexts: Promise<ReadonlyMap<string, readonly string[]>> | null = null

export function loadDocumentTexts(): Promise<
  ReadonlyMap<string, readonly string[]>
> {
  loadingTexts ??= (async () => {
    const db = await getDb()
    const tx = db.transaction('documentTexts')
    const [keys, values] = await Promise.all([
      tx.store.getAllKeys(),
      tx.store.getAll(),
    ])
    texts = new Map(keys.map((key, index) => [key, values[index]]))
    return texts
  })()
  return loadingTexts
}

/** The texts loaded so far (none until `loadDocumentTexts` has run). */
export function documentTexts(): ReadonlyMap<string, readonly string[]> {
  return texts ?? new Map()
}

export async function saveDocumentText(
  id: string,
  pages: string[],
): Promise<void> {
  await (await getDb()).put('documentTexts', pages, id)
  texts?.set(id, pages)
  textsChanged()
}
