import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'
import { closeDb } from '@/lib/db/db'
import { DB_NAME } from '@/lib/db/schema'
import {
  addDocument,
  deleteDocument,
  DocumentError,
  documents,
  purgeDeletedFiles,
  restoreDocument,
  updateDocument,
} from './documents'
import {
  documentTexts,
  listAllFiles,
  loadDocumentTexts,
  loadFile,
  saveDocumentText,
  saveThumb,
} from './files'
import {
  addHighlight,
  deleteHighlight,
  highlights,
  parseHighlight,
  restoreHighlight,
  updateHighlight,
} from './highlights'

afterEach(async () => {
  await documents.clear()
  await highlights.clear()
  await closeDb()
  indexedDB.deleteDatabase(DB_NAME)
})

const pdf = (name = 'Lecture_05.pdf', body = '%PDF-1.7\nrest of the file') =>
  new File([body], name, { type: 'application/pdf' })

describe('documents', () => {
  it('adds a PDF, keeping its file apart from its record', async () => {
    const document = await addDocument(pdf(), new Date('2026-10-10T00:00:00Z'))
    expect(document).toMatchObject({
      title: 'Lecture 05',
      fileName: 'Lecture_05.pdf',
      pages: null,
      lastPage: 1,
    })
    expect(documents.get()).toHaveLength(1)
    expect(await (await loadFile(document.id))?.text()).toContain('%PDF-1.7')
  })

  it("refuses files that aren't PDFs", async () => {
    await expect(addDocument(pdf('notes.pdf', '<html>'))).rejects.toThrow(
      DocumentError,
    )
    expect(documents.get()).toHaveLength(0)
  })

  it('remembers changes, and ignores ones that change nothing', async () => {
    const document = await addDocument(pdf(), new Date('2026-10-10T00:00:00Z'))
    await updateDocument(
      document.id,
      { lastPage: 12, pages: 40 },
      new Date('2026-10-10T01:00:00Z'),
    )
    await updateDocument(
      document.id,
      { title: '   ' },
      new Date('2026-10-10T02:00:00Z'),
    )
    expect(documents.find(document.id)).toMatchObject({
      lastPage: 12,
      pages: 40,
      title: 'Lecture 05',
      updatedAt: '2026-10-10T01:00:00.000Z',
    })
  })

  it("keeps a deleted document's file a day, for Undo, then frees it", async () => {
    const document = await addDocument(pdf())
    await saveThumb(document.id, new Blob(['png']))
    await saveDocumentText(document.id, ['page one'])
    await deleteDocument(document.id, new Date('2026-10-10T00:00:00Z'))
    await purgeDeletedFiles(new Date('2026-10-10T12:00:00Z'))
    expect(await loadFile(document.id)).toBeDefined()
    await restoreDocument(document.id)
    expect(documents.get()).toHaveLength(1)
    await deleteDocument(document.id, new Date('2026-10-10T00:00:00Z'))
    await purgeDeletedFiles(new Date('2026-10-11T12:00:00Z'))
    expect(await loadFile(document.id)).toBeUndefined()
    expect(await listAllFiles()).toEqual([])
  })

  it("keeps each document's text for search", async () => {
    const document = await addDocument(pdf())
    await saveDocumentText(document.id, ['Karnaugh maps', 'Gray code'])
    expect(documentTexts().size).toBe(0)
    expect((await loadDocumentTexts()).get(document.id)).toEqual([
      'Karnaugh maps',
      'Gray code',
    ])
  })
})

describe('highlights', () => {
  const rects = [{ x: 0.1, y: 0.2, w: 0.5, h: 0.02 }]

  it('adds, edits, deletes and restores', async () => {
    const highlight = await addHighlight({
      documentId: 'd',
      page: 3,
      rects,
      quote: ' Group  ones\nin powers of two ',
      color: 'green',
    })
    expect(highlight.quote).toBe('Group ones in powers of two')
    await updateHighlight(highlight.id, { note: 'Check the lab sheet.' })
    expect(highlights.find(highlight.id)?.note).toBe('Check the lab sheet.')
    await deleteHighlight(highlight.id)
    expect(highlights.get()).toHaveLength(0)
    await restoreHighlight(highlight.id)
    expect(highlights.get()).toHaveLength(1)
  })

  it('drops damaged records', () => {
    const base = {
      id: 'h',
      documentId: 'd',
      page: 1,
      rects,
      createdAt: 'x',
      updatedAt: 'x',
    }
    expect(parseHighlight(base)?.color).toBe('yellow')
    expect(
      parseHighlight({ ...base, rects: [{ x: 2, y: 0, w: 1, h: 1 }] }),
    ).toBeNull()
    expect(parseHighlight({ ...base, page: 0 })).toBeNull()
  })
})
