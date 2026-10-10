import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ChatRequest } from '@/features/ai'
import { setTaskModel, setTaskProvider } from '@/features/ai/store'
import { setExcluded } from '@/features/embeddings'
import { documents } from '@/features/library'
import { saveDocumentText } from '@/features/library/files'
import { createNote, notes } from '@/features/notes'
import { addTask, tasks } from '@/features/tasks'
import { closeDb } from '@/lib/db/db'
import { DB_NAME } from '@/lib/db/schema'
import { ask, askAgain, liveAnswersStore, stopAnswer } from './chat'
import {
  conversations,
  newConversation,
  parseConversation,
} from './conversations'
import { LIBRARY_SYSTEM } from './lib/prompt'
import { plannerSnapshot } from './lib/snapshot'
import { gatherSnapshotData } from './planner'
import { findPassages } from './retrieval'

/** What the provider is asked, and how it answers. */
const script = vi.hoisted(() => ({
  requests: [] as unknown[],
  reply: (() => ({ chunks: ['An answer.'] })) as (request: unknown) => {
    chunks: string[]
    fail?: boolean
    delayMs?: number
    /** On Stop, end as though the reply were complete (some SDKs do). */
    quiet?: boolean
  },
}))

vi.mock('@/features/ai/providers', async () => {
  const { AiError, abortError } = await import('@/features/ai/errors')
  return {
    createProvider: () => ({
      id: 'compatible',
      async *chat(request: ChatRequest) {
        script.requests.push(request)
        const { chunks, fail, delayMs = 0, quiet } = script.reply(request)
        yield { type: 'usage', usage: { inputTokens: 100, outputTokens: 0 } }
        for (const text of chunks) {
          await new Promise((resolve) => setTimeout(resolve, delayMs))
          if (request.signal?.aborted && quiet) break
          if (request.signal?.aborted) throw abortError()
          yield { type: 'text', text }
        }
        if (fail) throw new AiError('overloaded', 'Busy')
        yield { type: 'usage', usage: { inputTokens: 100, outputTokens: 20 } }
        yield { type: 'done', stopReason: 'end' }
      },
      embed: async () => ({
        vectors: [],
        usage: { inputTokens: 0, outputTokens: 0 },
      }),
      listModels: async () => [],
    }),
  }
})

const requests = () => script.requests as ChatRequest[]

async function addLecture() {
  await documents.add({
    id: 'doc1',
    title: 'Lecture 5',
    fileName: 'lecture5.pdf',
    size: 1000,
    pages: 3,
    subjectId: null,
    lastPage: 1,
    lastOpenedAt: null,
    createdAt: '2026-10-01T00:00:00.000Z',
    updatedAt: '2026-10-01T00:00:00.000Z',
    deletedAt: null,
  })
  await saveDocumentText('doc1', [
    'Digital logic, lecture five: simplifying Boolean functions with maps.',
    'A Karnaugh map groups adjacent ones in rectangles of one, two, four or eight cells.',
    'Gray code orders the rows so that neighbouring cells differ in exactly one bit.',
  ])
}

async function start(mode: 'library' | 'planner' = 'library') {
  const conversation = newConversation(mode)
  await conversations.add(conversation)
  return conversation.id
}

beforeEach(() => {
  setTaskProvider('chat', 'compatible')
  setTaskModel('chat', 'local-chat', 'compatible')
  script.requests.length = 0
  script.reply = () => ({ chunks: ['Group ones in powers of two ', '[1].'] })
})

afterEach(async () => {
  await Promise.all([
    conversations.clear(),
    notes.clear(),
    documents.clear(),
    tasks.clear(),
  ])
  await closeDb()
  indexedDB.deleteDatabase(DB_NAME)
})

describe('finding passages', () => {
  it('finds the pages and notes that share the question’s words', async () => {
    await addLecture()
    await createNote({
      title: 'Pasta bake',
      body: 'Boil the penne, then bake with tomato sauce and cheese.',
    })
    const found = await findPassages('How do I group ones in a Karnaugh map?')
    expect(found[0]).toMatchObject({
      key: 'document:doc1',
      page: 2,
      title: 'Lecture 5',
    })
    expect(found.some((passage) => passage.title === 'Pasta bake')).toBe(false)
  })

  it('can keep to one document', async () => {
    await addLecture()
    await createNote({
      title: 'Gray code',
      body: 'Gray code changes one bit at a time.',
    })
    const found = await findPassages('gray code bits', { documentId: 'doc1' })
    expect(found.length).toBeGreaterThan(0)
    expect(found.every((passage) => passage.key === 'document:doc1')).toBe(true)
  })

  it('leaves out what was kept out of search by meaning', async () => {
    await addLecture()
    const diary = await createNote({
      title: 'Diary',
      body: 'Karnaugh maps made me nervous before the exam.',
    })
    setExcluded([`note:${diary.id}`, 'document:doc1'], true)
    try {
      expect(await findPassages('karnaugh maps')).toEqual([])
      // Unless it's the document being asked about.
      const found = await findPassages('karnaugh maps', { documentId: 'doc1' })
      expect(found[0]).toMatchObject({ key: 'document:doc1', page: 2 })
    } finally {
      setExcluded([`note:${diary.id}`, 'document:doc1'], false)
    }
  })

  it('spreads the rest through a document a question has few words of', async () => {
    await documents.add({
      id: 'doc2',
      title: 'Course outline',
      fileName: 'outline.pdf',
      size: 1000,
      pages: 12,
      subjectId: null,
      lastPage: 1,
      lastOpenedAt: null,
      createdAt: '2026-10-01T00:00:00.000Z',
      updatedAt: '2026-10-01T00:00:00.000Z',
      deletedAt: null,
    })
    await saveDocumentText(
      'doc2',
      Array.from(
        { length: 12 },
        (_, i) =>
          `Week ${i + 1} covers topic ${i + 1} of the course in detail.`,
      ),
    )
    const found = await findPassages('Summarise this document', {
      documentId: 'doc2',
    })
    expect(found.map((passage) => passage.page)).toEqual([1, 3, 5, 7, 9, 11])
    // Not for questions about everything.
    expect(await findPassages('Summarise this document')).toEqual([])
  })

  it('joins passages that follow each other on a page', async () => {
    const sentence = (i: number) =>
      `Karnaugh map rule ${i} covers adjacent cells in a rectangle of the grid.`
    await createNote({
      title: 'Map rules',
      body: Array.from({ length: 40 }, (_, i) => sentence(i)).join(' '),
    })
    const found = await findPassages('karnaugh map adjacent cells rectangle')
    expect(found).toHaveLength(1)
    const [passage] = found
    // Several of the note's passages, as one, with nothing repeated.
    expect(passage.text.length).toBeGreaterThan(900)
    for (let i = 0; i < 40; i++)
      expect(passage.text.split(sentence(i)).length).toBeLessThanOrEqual(2)
  })
})

describe('asking', () => {
  it('sends the question with its passages, and keeps the answer', async () => {
    await addLecture()
    const id = await start()
    const sources = await findPassages('karnaugh map groups')
    await ask(id, 'How do Karnaugh maps group cells?', { sources })

    const [request] = requests()
    expect(request.system).toBe(LIBRARY_SYSTEM)
    expect(request.messages).toHaveLength(1)
    expect(request.messages[0].content).toMatch(
      /^<sources>\n\[1\] Lecture 5, page 2 \(document\)\nA Karnaugh map/,
    )
    expect(request.messages[0].content).toMatch(
      /Question: How do Karnaugh maps group cells\?$/,
    )

    const conversation = conversations.find(id)!
    expect(conversation.title).toBe('How do Karnaugh maps group cells?')
    const [question, answer] = conversation.messages
    expect(question).toMatchObject({ role: 'user', sources })
    expect(answer).toMatchObject({
      role: 'assistant',
      text: 'Group ones in powers of two [1].',
      model: 'local-chat',
      stopReason: 'end',
      usage: { inputTokens: 100, outputTokens: 20 },
    })
    expect(answer.pending).toBeUndefined()
    expect(liveAnswersStore.get().size).toBe(0)
  })

  it('sends earlier messages as they were, without their passages', async () => {
    await addLecture()
    const id = await start()
    await ask(id, 'First?', { sources: await findPassages('karnaugh') })
    await ask(id, 'And Gray code?', {
      sources: await findPassages('gray code'),
    })
    const second = requests()[1]
    expect(second.messages.map((message) => message.role)).toEqual([
      'user',
      'assistant',
      'user',
    ])
    expect(second.messages[0].content).toBe('First?')
    expect(second.messages[2].content).toMatch(/Gray code orders the rows/)
  })

  it('shares only the chosen parts of your plans', async () => {
    await addTask({
      title: 'Lab report',
      subjectId: null,
      due: null,
      time: null,
      priority: 3,
      recurrence: null,
    })
    const id = await start('planner')
    const snapshot = plannerSnapshot(gatherSnapshotData(), new Set(['tasks']))
    await ask(id, 'What should I do next?', { snapshot })
    const [request] = requests()
    expect(request.system).toMatch(/planning assistant/)
    expect(request.messages[0].content).toContain(
      '- Lab report (high priority)',
    )
    expect(request.messages[0].content).not.toContain('Habits')
    expect(conversations.find(id)!.messages[0].snapshot).toBe(snapshot)
  })

  it('keeps a failed answer with its reason, and can ask again', async () => {
    const id = await start()
    script.reply = () => ({ chunks: ['Half an'], fail: true })
    await ask(id, 'Why?', { sources: [] })
    let [, answer] = conversations.find(id)!.messages
    expect(answer.error).toMatch(/busy/i)
    expect(answer.text).toBe('Half an')

    script.reply = () => ({ chunks: ['Because.'] })
    await askAgain(id, answer.id)
    const messages = conversations.find(id)!.messages
    expect(messages).toHaveLength(2)
    ;[, answer] = messages
    expect(answer).toMatchObject({ text: 'Because.', stopReason: 'end' })
    expect(answer.error).toBeUndefined()
    // Asked again with what was sent the first time.
    expect(requests()[1].messages).toEqual(requests()[0].messages)
  })

  it.each([
    ['with an error', false],
    ['quietly', true],
  ])(
    'stops when asked, keeping what had arrived (stream ends %s)',
    async (_, quiet) => {
      const id = await start()
      // Slow enough that stopping lands long before the end.
      script.reply = () => ({
        chunks: Array.from({ length: 40 }, (_, i) => `word${i} `),
        delayMs: 40,
        quiet,
      })
      const asking = ask(id, 'Tell me everything', { sources: [] })
      await vi.waitFor(() => {
        const live = [...liveAnswersStore.get().values()][0]
        expect(live?.length).toBeGreaterThan(0)
      })
      stopAnswer(id)
      await asking
      const [, answer] = conversations.find(id)!.messages
      expect(answer.stopped).toBe(true)
      expect(answer.error).toBeUndefined()
      expect(answer.stopReason).toBeUndefined()
      expect(answer.text).toMatch(/^word0 /)
      expect(answer.text).not.toContain('word39')
    },
  )
})

describe('parseConversation', () => {
  it('keeps what it understands of a stored conversation', () => {
    const parsed = parseConversation({
      id: 'c1',
      createdAt: 'x',
      updatedAt: 'y',
      mode: 'nonsense',
      messages: [
        {
          id: 'm1',
          role: 'user',
          text: 'Hi',
          createdAt: 'x',
          sources: [
            { key: 'note:a', kind: 'note', id: 'a', text: 'T' },
            { junk: true },
          ],
        },
        { id: 'm2', role: 'robot', text: 'No', createdAt: 'x' },
        {
          id: 'm3',
          role: 'assistant',
          text: 'Yo',
          createdAt: 'x',
          stopReason: 'weird',
          stopped: true,
        },
      ],
    })
    expect(parsed?.mode).toBe('library')
    expect(parsed?.messages.map((message) => message.id)).toEqual(['m1', 'm3'])
    expect(parsed?.messages[0].sources).toEqual([
      {
        key: 'note:a',
        kind: 'note',
        id: 'a',
        title: '',
        page: null,
        text: 'T',
      },
    ])
    expect(parsed?.messages[1]).toMatchObject({ stopped: true })
    expect(parsed?.messages[1].stopReason).toBeUndefined()
    expect(parseConversation({ id: 1 })).toBeNull()
  })
})
