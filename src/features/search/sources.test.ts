import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'
import { cards } from '@/features/flashcards'
import { addCards } from '@/features/flashcards/actions'
import { goals } from '@/features/goals'
import { achieveGoal, addGoal } from '@/features/goals/actions'
import { addHabit, habitsStore } from '@/features/habits'
import { capture, inboxItems } from '@/features/inbox'
import { documents, loadDocumentTexts } from '@/features/library'
import { saveDocumentText } from '@/features/library/files'
import { logEntries, setLine } from '@/features/log'
import { createNote, notes, saveNote } from '@/features/notes'
import { addRoutine, routinesStore } from '@/features/routines'
import { addTask, completeTask, tasks } from '@/features/tasks'
import type { MarkedText } from '@/lib/commands'
import { formatDateKey } from '@/lib/date'
import { searchEverything } from './sources'

afterEach(async () => {
  await Promise.all([
    notes.clear(),
    tasks.clear(),
    logEntries.clear(),
    inboxItems.clear(),
    documents.clear(),
    cards.clear(),
    goals.clear(),
  ])
  habitsStore.reset()
  routinesStore.reset()
})

const text = (parts?: readonly MarkedText[]) =>
  parts?.map((part) => (part.match ? `[${part.text}]` : part.text)).join('')

const task = (title: string, subjectId: string | null = null) =>
  addTask({
    title,
    subjectId,
    due: null,
    time: null,
    priority: 0,
    recurrence: null,
  })

describe('searching everything', () => {
  it('finds notes, tasks, habits, routines, log lines and the inbox', async () => {
    const note = await createNote({
      title: 'Karnaugh maps',
      body: '## Grouping\n\nGroup ones in powers of two.\n\n```verilog\nassign f = ~(a ^ c);\n```',
    })
    await createNote({ title: '', body: '' })
    await task('Practise Karnaugh maps', 'digital-logic')
    addHabit('Read a chapter')
    addRoutine({
      name: 'Study warm-up',
      part: 'morning',
      steps: ['Review Karnaugh notes'],
    })
    await setLine('2026-10-08', 'Finished the Karnaugh lab')
    await capture('Karnaugh map video https://example.com/k')

    // Kinds come in the order of their best match: two titles starting
    // with the word, one with it later on, then text that mentions it.
    const results = searchEverything('karnaugh')
    expect(results.map((result) => result.section)).toEqual([
      'Notes',
      'Inbox',
      'Tasks',
      'Routines',
      'Log',
    ])
    const [first] = results
    expect(first.id).toBe(`note:${note.id}`)
    expect(text(first.title)).toBe('[Karnaugh] maps')
    const routine = results.find((result) => result.section === 'Routines')!
    expect(text(routine.snippet)).toBe('Review [Karnaugh] notes')
    expect(routine.detail).toBe('Morning')

    // Code in notes is searchable; subjects find what they label.
    expect(searchEverything('assign').map((r) => r.id)).toEqual([
      `note:${note.id}`,
    ])
    expect(searchEverything('digital logic')[0].section).toBe('Tasks')
    expect(searchEverything('chapter')[0].detail).toBe('Every day')
    expect(searchEverything('')).toEqual([])
  })

  it('puts finished tasks below open ones, and keeps up with edits', async () => {
    // The finished one's title starts with the words; still, it's history.
    const done = await task('Lab report draft')
    await task('Final lab report')
    await completeTask(done!.id)
    const titles = searchEverything('lab report').map((r) => text(r.title))
    expect(titles).toEqual(['Final [lab] [report]', '[Lab] [report] draft'])
    expect(searchEverything('lab report')[1].detail).toBe('Done')

    const note = await createNote({ title: 'Draft' })
    expect(searchEverything('flip')).toEqual([])
    await saveNote(note.id, { body: 'Flip-flops store one bit.' })
    expect(text(searchEverything('flip')[0].snippet)).toBe(
      '[Flip]-flops store one bit.',
    )
  })

  it('finds cards by either side', async () => {
    const [card] = await addCards(
      [
        {
          front: 'What does a **Karnaugh map** group?',
          back: 'Adjacent ones, in rectangles of $2^n$ cells',
        },
      ],
      { subjectId: null },
    )
    const [byFront] = searchEverything('karnaugh')
    expect(byFront).toMatchObject({ id: `card:${card.id}`, section: 'Cards' })
    expect(text(byFront.title)).toBe('What does a [Karnaugh] map group?')
    expect(byFront.detail).toBe('New')
    expect(searchEverything('rectangles')[0].id).toBe(`card:${card.id}`)
  })

  it('finds goals by title, milestones and why they matter', async () => {
    const goal = await addGoal({
      title: 'Distinction in Digital Logic',
      why: 'The honours year needs it',
      target: '2026-11-20',
      milestones: ['Karnaugh map quiz', 'Final exam'],
    })
    const done = await addGoal({ title: 'Digital Logic lab skills' })
    await achieveGoal(done!.id)
    const [byTitle, closed] = searchEverything('digital logic')
    expect(byTitle).toMatchObject({ id: `goal:${goal!.id}`, section: 'Goals' })
    expect(byTitle.detail).toBe(
      `By ${formatDateKey('2026-11-20', { weekday: 'short', day: 'numeric', month: 'short' })}`,
    )
    // Reached goals come after the ones on the go.
    expect(closed).toMatchObject({ id: `goal:${done!.id}`, detail: 'Reached' })
    expect(text(searchEverything('honours')[0].snippet)).toBe(
      'The [honours] year needs it',
    )
    expect(searchEverything('karnaugh quiz')[0].id).toBe(`goal:${goal!.id}`)
  })

  it('lists at most five of a kind', async () => {
    for (let i = 0; i < 8; i++) await createNote({ title: `Revision ${i}` })
    expect(searchEverything('revision')).toHaveLength(5)
  })

  it('finds words inside documents, on their page', async () => {
    const now = new Date().toISOString()
    await documents.add({
      id: 'slides',
      title: 'Lecture 5 slides',
      fileName: 'lecture5.pdf',
      size: 1000,
      pages: 3,
      subjectId: null,
      lastPage: 1,
      lastOpenedAt: null,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    })
    await saveDocumentText('slides', [
      'Intro',
      'Gray code counts in one-bit steps',
      'Summary',
    ])
    await loadDocumentTexts()
    const [result] = searchEverything('gray code')
    expect(result.section).toBe('Documents')
    expect(result.detail).toBe('p. 2')
    expect(text(result.snippet)).toBe('[Gray] [code] counts in one-bit steps')
    expect(searchEverything('lecture')[0].detail).toBe('3 pages')
  })
})
