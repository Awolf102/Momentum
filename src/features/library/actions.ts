import { createNote } from '@/features/notes'
import { navigate, paths } from '@/lib/routes'
import { createStore } from '@/lib/store'
import { addDocument, DocumentError, documents } from './documents'
import { loadDocumentTexts } from './files'
import { highlights } from './highlights'
import { highlightsToMarkdown } from './lib/note'
import type { PDFDocumentProxy } from './pdf/pdfjs'
import type { LibraryDocument } from './types'

/**
 * Documents being read in the background (page count, picture, text), ones
 * that couldn't be, and ones waiting for their password.
 */
export const readingStore = createStore<{
  reading: ReadonlySet<string>
  failed: ReadonlySet<string>
  locked: ReadonlySet<string>
}>({ reading: new Set(), failed: new Set(), locked: new Set() })

const without = (set: ReadonlySet<string>, id: string) => {
  const next = new Set(set)
  next.delete(id)
  return next
}

const isPasswordError = (error: unknown) =>
  (error as { name?: string } | null)?.name === 'PasswordException'

/** Reads a document in the background, once at a time. */
export function readInBackground(id: string): void {
  const state = readingStore.get()
  if (state.reading.has(id) || state.failed.has(id) || state.locked.has(id))
    return
  readingStore.set({ ...state, reading: new Set(state.reading).add(id) })
  void import('./pdf/process')
    .then(({ processDocument }) => processDocument(id))
    .then(
      () => 'read' as const,
      (error: unknown) => {
        if (isPasswordError(error)) return 'locked' as const
        console.warn('[momentum] Could not read a document.', error)
        return 'failed' as const
      },
    )
    .then((outcome) => {
      const current = readingStore.get()
      readingStore.set({
        reading: without(current.reading, id),
        failed:
          outcome === 'failed'
            ? new Set(current.failed).add(id)
            : current.failed,
        locked:
          outcome === 'locked'
            ? new Set(current.locked).add(id)
            : current.locked,
      })
    })
}

/**
 * A protected document has been opened with its password: read it now,
 * from the open PDF.
 */
export function readUnlocked(id: string, pdf: PDFDocumentProxy): void {
  const current = readingStore.get()
  if (!current.locked.has(id)) return
  readingStore.set({ ...current, locked: without(current.locked, id) })
  void import('./pdf/process').then(({ readPdf }) => readPdf(id, pdf))
}

/** Adds files to the library; says which couldn't be added, and why. */
export async function addFiles(
  files: readonly File[],
): Promise<{ added: LibraryDocument[]; problems: string[] }> {
  const added: LibraryDocument[] = []
  const problems: string[] = []
  for (const file of files) {
    try {
      const document = await addDocument(file)
      added.push(document)
      readInBackground(document.id)
    } catch (error) {
      problems.push(
        error instanceof DocumentError
          ? error.message
          : `${file.name} couldn't be saved.`,
      )
    }
  }
  return { added, problems }
}

/**
 * Asks for PDFs (a file picker) and adds them, then shows the library. For
 * commands: the picker has to open while the key press still counts as one.
 */
export function choosePdfs(): void {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = 'application/pdf,.pdf'
  input.multiple = true
  input.addEventListener('change', async () => {
    const files = [...(input.files ?? [])]
    if (files.length === 0) return
    const { added } = await addFiles(files)
    navigate(added.length === 1 ? paths.document(added[0].id) : paths.library)
  })
  input.click()
}

/**
 * Reads documents that haven't been yet, or whose text isn't here (both
 * happen to documents restored from a backup).
 */
export async function readUnread(): Promise<void> {
  const texts = await loadDocumentTexts()
  for (const document of documents.get())
    if (document.pages === null || !texts.has(document.id))
      readInBackground(document.id)
}

/** Turns a document's highlights into a note, and opens it. */
export async function noteFromHighlights(
  document: LibraryDocument,
): Promise<void> {
  const own = highlights
    .get()
    .filter((highlight) => highlight.documentId === document.id)
  const note = await createNote({
    title: `${document.title} — highlights`,
    body: highlightsToMarkdown(document.title, own),
    subjectId: document.subjectId,
  })
  navigate(paths.note(note.id))
}
