import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { setTaskModel, setTaskProvider } from '@/features/ai/store'
import { documents } from '@/features/library'
import { saveDocumentText } from '@/features/library/files'
import { createNote, deleteNote, notes, saveNote } from '@/features/notes'
import { closeDb } from '@/lib/db/db'
import { DB_NAME } from '@/lib/db/schema'
import { indexOverview, updateIndex } from './indexer'
import { passageSnippet } from './palette'
import { relatedTo, searchByMeaning } from './search'
import { embeddingSettingsStore, setExcluded } from './settings'
import { clearIndex, readSourceRecords } from './storage'

/** Everything the provider was sent, request by request. */
const sent = vi.hoisted(() => [] as string[][])

// A provider whose vectors count words (so texts sharing words are close),
// recording what it's sent.
vi.mock('@/features/ai/providers', async () => {
  const { createMockProvider } = await import('@/features/ai/providers/mock')
  const words = (text: string) =>
    text
      .toLowerCase()
      .replace(/^search_(query|document): /, '')
      .match(/[a-z]{4,}/g) ?? []
  const vector = (text: string) => {
    const result = new Array<number>(64).fill(0)
    for (const word of words(text)) {
      let hash = 0
      for (const char of word) hash = (hash * 31 + char.charCodeAt(0)) % 64
      result[hash] += 1
    }
    return result
  }
  const provider = createMockProvider({ embed: vector })
  return {
    createProvider: () => ({
      ...provider,
      embed: async (request: { input: string[] }) => {
        sent.push([...request.input])
        return provider.embed(request as never)
      },
    }),
  }
})

const PAGES = [
  'Sequential logic remembers. A flip flop stores one bit of state, and a register is a row of flip flops sharing a clock.',
  'Karnaugh maps simplify Boolean expressions by grouping adjacent ones in powers of two.',
]

async function addLectures() {
  await documents.add({
    id: 'doc1',
    title: 'Digital logic lectures',
    fileName: 'lectures.pdf',
    size: 1000,
    pages: 2,
    subjectId: null,
    lastPage: 1,
    lastOpenedAt: null,
    createdAt: '2026-10-01T00:00:00.000Z',
    updatedAt: '2026-10-01T00:00:00.000Z',
    deletedAt: null,
  })
  await saveDocumentText('doc1', PAGES)
}

beforeEach(() => {
  // A local server's model that wants to be told searches from passages.
  setTaskProvider('embeddings', 'compatible')
  setTaskModel('embeddings', 'nomic-embed-text', 'compatible')
})

afterEach(async () => {
  sent.length = 0
  embeddingSettingsStore.reset()
  await clearIndex()
  await Promise.all([notes.clear(), documents.clear()])
  await closeDb()
  indexedDB.deleteDatabase(DB_NAME)
})

describe('the index', () => {
  it('sends nothing until asked, then indexes every note and page', async () => {
    await createNote({
      title: 'Latches',
      body: 'A latch is level sensitive: it stores state while enabled.',
    })
    await createNote({
      title: 'Groceries',
      body: 'Bananas, coffee beans, oats and yoghurt for the week.',
    })
    await addLectures()

    const before = await indexOverview()
    expect(sent).toEqual([])
    expect(before?.pending.map((item) => item.source.key).sort()).toEqual([
      'document:doc1',
      expect.stringMatching(/^note:/),
      expect.stringMatching(/^note:/),
    ])
    expect(before?.pending.every((item) => item.passages > 0)).toBe(true)

    const result = await updateIndex()
    expect(result.embedded).toBe(3)
    // Passages carry their title, and the model's "this is a passage" prompt.
    expect(sent.flat()).toContain(
      `search_document: Digital logic lectures\n\n${PAGES[1]}`,
    )

    const after = await indexOverview()
    expect(after?.pending).toEqual([])
    expect(after?.indexed).toEqual({ notes: 2, documents: 1, passages: 4 })
  })

  it('finds passages by meaning, with their page, and remembers searches', async () => {
    await createNote({
      title: 'Groceries',
      body: 'Bananas, coffee beans, oats and yoghurt for the week.',
    })
    await addLectures()
    await updateIndex()
    sent.length = 0

    const { hits, searched } = await searchByMeaning('grouping ones karnaugh')
    expect(searched).toBe(2)
    expect(hits[0]).toMatchObject({ key: 'document:doc1', page: 2 })
    // Nothing unrelated pads out the list.
    expect(hits.map((hit) => hit.kind)).toEqual(['document'])
    expect(sent).toEqual([['search_query: grouping ones karnaugh']])

    await searchByMeaning('grouping ones karnaugh')
    expect(sent).toHaveLength(1)
  })

  it('indexes only what changed, and takes out what was deleted', async () => {
    const latches = await createNote({
      title: 'Latches',
      body: 'A latch is level sensitive: it stores state while enabled.',
    })
    const groceries = await createNote({
      title: 'Groceries',
      body: 'Bananas, coffee beans, oats and yoghurt for the week.',
    })
    await updateIndex()
    sent.length = 0

    await saveNote(latches.id, {
      body: 'A latch is level sensitive; a flip flop is edge triggered.',
    })
    await deleteNote(groceries.id)
    const overview = await indexOverview()
    expect(overview?.pending.map((item) => item.source.id)).toEqual([
      latches.id,
    ])

    // Taking out what's gone sends nothing.
    await updateIndex({ removalsOnly: true })
    expect(sent).toEqual([])
    expect((await readSourceRecords()).map((record) => record.id)).toEqual([
      latches.id,
    ])

    await updateIndex()
    expect(sent.flat()).toEqual([
      'search_document: Latches\n\nA latch is level sensitive; a flip flop is edge triggered.',
    ])
  })

  it('sends only what was chosen, and keeps out what was unticked', async () => {
    const latches = await createNote({
      title: 'Latches',
      body: 'A latch is level sensitive: it stores state while enabled.',
    })
    const diary = await createNote({
      title: 'Diary',
      body: 'Private thoughts about the week that should stay on this device.',
    })
    setExcluded([`note:${diary.id}`], true)
    await updateIndex({ only: new Set([`note:${latches.id}`]) })
    expect(sent.flat().some((text) => text.includes('Private'))).toBe(false)

    const overview = await indexOverview()
    expect(overview?.pending).toEqual([])
    expect(overview?.excluded.map((item) => item.source.id)).toEqual([diary.id])
  })

  it('starts again for another model, keeping the old vectors meanwhile', async () => {
    await createNote({
      title: 'Latches',
      body: 'A latch is level sensitive: it stores state while enabled.',
    })
    await updateIndex()
    setTaskModel('embeddings', 'mxbai-embed-large', 'compatible')

    const overview = await indexOverview()
    expect(overview?.pending).toHaveLength(1)
    expect(overview?.indexed.passages).toBe(0)
    expect(await readSourceRecords()).toHaveLength(1)
    expect((await searchByMeaning('latch state')).searched).toBe(0)
  })

  it('finds related notes and pages from vectors already indexed', async () => {
    const note = await createNote({
      title: 'Registers',
      body: 'Registers are rows of flip flops that share a clock and store state.',
    })
    await createNote({
      title: 'Groceries',
      body: 'Bananas, coffee beans, oats and yoghurt for the week.',
    })
    await addLectures()
    await updateIndex()
    sent.length = 0

    const related = await relatedTo(`note:${note.id}`)
    expect(related[0]).toMatchObject({ key: 'document:doc1', page: 1 })
    expect(related.some((hit) => hit.kind === 'note')).toBe(false)
    expect(sent).toEqual([])
  })
})

describe('passageSnippet', () => {
  const text =
    'Counters are built from flip flops. A ripple counter chains them. Synchronous counters share one clock.'

  it('starts at the first sentence sharing a word, marking it', () => {
    expect(passageSnippet(text, 'synchronous design')).toEqual([
      { text: '…', match: false },
      { text: 'Synchronous', match: true },
      { text: ' counters share one clock.', match: false },
    ])
  })

  it('starts at the beginning when no word is shared', () => {
    expect(passageSnippet(text, 'memory')).toEqual([{ text, match: false }])
  })
})
