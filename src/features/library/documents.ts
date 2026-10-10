import { createCollection } from '@/lib/collection'
import { isRecord } from '@/lib/guards'
import { createId } from '@/lib/id'
import { deleteFiles, putFile, storedDocumentIds } from './files'
import { formatSize, isPdf, MAX_FILE_SIZE, titleFromFileName } from './lib/file'
import type { LibraryDocument } from './types'

export const MAX_TITLE_LENGTH = 160

export function parseDocument(value: unknown): LibraryDocument | null {
  if (!isRecord(value)) return null
  const { id, title, fileName, size, pages, subjectId, lastPage } = value
  const { createdAt, updatedAt, lastOpenedAt } = value
  if (typeof id !== 'string' || typeof createdAt !== 'string') return null
  if (typeof updatedAt !== 'string') return null
  const count = (n: unknown) =>
    typeof n === 'number' && Number.isInteger(n) && n > 0 ? n : null
  return {
    id,
    title:
      typeof title === 'string' && title.trim()
        ? title.slice(0, MAX_TITLE_LENGTH)
        : 'Untitled document',
    fileName: typeof fileName === 'string' ? fileName : '',
    size: typeof size === 'number' && size >= 0 ? size : 0,
    pages: count(pages),
    subjectId: typeof subjectId === 'string' ? subjectId : null,
    lastPage: count(lastPage) ?? 1,
    lastOpenedAt: typeof lastOpenedAt === 'string' ? lastOpenedAt : null,
    createdAt,
    updatedAt,
    deletedAt: typeof value.deletedAt === 'string' ? value.deletedAt : null,
  }
}

/** Every document in the library. */
export const documents = createCollection<LibraryDocument>({
  name: 'documents',
  parse: parseDocument,
})

/** Why a file couldn't be added, in words to show. */
export class DocumentError extends Error {}

/** Adds a PDF to the library: its file, then its record. */
export async function addDocument(
  file: File,
  now: Date = new Date(),
): Promise<LibraryDocument> {
  if (file.size > MAX_FILE_SIZE)
    throw new DocumentError(
      `${file.name} is ${formatSize(file.size)}; the library takes PDFs up to ${formatSize(MAX_FILE_SIZE)}.`,
    )
  const head = new Uint8Array(await file.slice(0, 1024).arrayBuffer())
  if (!isPdf(head)) throw new DocumentError(`${file.name} isn't a PDF.`)
  const stamp = now.toISOString()
  const document: LibraryDocument = {
    id: createId(),
    title: titleFromFileName(file.name).slice(0, MAX_TITLE_LENGTH),
    fileName: file.name,
    size: file.size,
    pages: null,
    subjectId: null,
    lastPage: 1,
    lastOpenedAt: null,
    createdAt: stamp,
    updatedAt: stamp,
    deletedAt: null,
  }
  await putFile(document.id, file)
  await documents.add(document)
  return document
}

export type DocumentChanges = Partial<
  Pick<
    LibraryDocument,
    'title' | 'subjectId' | 'pages' | 'lastPage' | 'lastOpenedAt'
  >
>

export async function updateDocument(
  id: string,
  changes: DocumentChanges,
  now: Date = new Date(),
): Promise<void> {
  const document = documents.find(id)
  if (!document || document.deletedAt) return
  const next: LibraryDocument = { ...document, ...changes }
  if (changes.title !== undefined)
    next.title =
      changes.title.trim().slice(0, MAX_TITLE_LENGTH) || document.title
  const changed = (Object.keys(changes) as (keyof DocumentChanges)[]).some(
    (key) => next[key] !== document[key],
  )
  if (changed) await documents.put({ ...next, updatedAt: now.toISOString() })
}

/** Removes a document from the library; its file stays a while, for Undo. */
export async function deleteDocument(id: string, now: Date = new Date()) {
  await documents.remove(id, now)
}

export async function restoreDocument(id: string, now: Date = new Date()) {
  const document = documents.find(id)
  if (!document?.deletedAt) return
  await documents.put({
    ...document,
    deletedAt: null,
    updatedAt: now.toISOString(),
  })
}

const DAY_MS = 24 * 60 * 60 * 1000

/**
 * Frees the space of documents deleted more than a day ago (or whose record
 * is gone altogether): their files, pictures and text.
 */
export async function purgeDeletedFiles(now: Date = new Date()) {
  for (const id of await storedDocumentIds()) {
    const document = documents.find(id)
    const deletedAt = document?.deletedAt
    const gone =
      !document ||
      (typeof deletedAt === 'string' &&
        now.getTime() - Date.parse(deletedAt) > DAY_MS)
    if (gone) await deleteFiles(id)
  }
}
