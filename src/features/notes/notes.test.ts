import { afterEach, describe, expect, it } from 'vitest'
import {
  createNote,
  deleteNote,
  findByTitle,
  isEmptyNote,
  notes,
  restoreNote,
  saveNote,
  sortNotes,
  tidyEmptyNotes,
} from './notes'

afterEach(() => notes.clear())

const at = (minutes: number) => new Date(Date.UTC(2026, 9, 10, 1, minutes))

describe('notes', () => {
  it('creates, saves and finds notes by title', async () => {
    const note = await createNote({ title: ' Karnaugh maps ' }, at(0))
    expect(note.title).toBe('Karnaugh maps')
    await saveNote(note.id, { body: 'Group ones in powers of two.' }, at(1))
    expect(findByTitle('karnaugh   MAPS')?.body).toBe(
      'Group ones in powers of two.',
    )
    // Nothing changed: nothing saved.
    await saveNote(note.id, { body: 'Group ones in powers of two.' }, at(2))
    expect(notes.find(note.id)?.updatedAt).toBe(at(1).toISOString())
  })

  it('carries a rename into the links of other notes', async () => {
    const target = await createNote({ title: 'Gates' }, at(0))
    const linking = await createNote(
      { title: 'Adders', body: 'From [[gates]] and [[Gates|logic gates]].' },
      at(1),
    )
    const unrelated = await createNote(
      { title: 'Other', body: '[[Else]]' },
      at(2),
    )
    await saveNote(target.id, { title: 'Logic gates' }, at(3))
    expect(notes.find(linking.id)?.body).toBe(
      'From [[Logic gates]] and [[Logic gates|logic gates]].',
    )
    expect(notes.find(unrelated.id)?.updatedAt).toBe(at(2).toISOString())
  })

  it('deletes softly', async () => {
    const note = await createNote({ title: 'Scratch' }, at(0))
    await deleteNote(note.id, at(1))
    expect(notes.get()).toHaveLength(0)
    expect(findByTitle('Scratch')).toBeUndefined()
  })

  it('brings a deleted note back', async () => {
    const note = await createNote({ title: 'Oops' }, at(0))
    await deleteNote(note.id, at(1))
    expect(notes.get()).toHaveLength(0)
    await restoreNote(note.id, at(2))
    expect(notes.get().map((each) => each.title)).toEqual(['Oops'])
  })

  it('lists pinned notes first, then the latest', async () => {
    const old = await createNote({ title: 'Old' }, at(0))
    await createNote({ title: 'New' }, at(5))
    const pinned = await createNote({ title: 'Pinned' }, at(1))
    await saveNote(pinned.id, { pinned: true }, at(2))
    expect(sortNotes(notes.get()).map((each) => each.title)).toEqual([
      'Pinned',
      'New',
      'Old',
    ])
    expect(isEmptyNote({ ...old, title: ' ', body: '\n' })).toBe(true)
  })

  it('tidies away notes left empty', async () => {
    const kept = await createNote({}, at(0))
    const left = await createNote({}, at(0))
    const written = await createNote({ title: 'Has a title' }, at(0))
    // Empty, but from another tab and recent: it may still be written.
    await notes.add({
      ...left,
      id: 'elsewhere',
      updatedAt: at(9).toISOString(),
    })
    await tidyEmptyNotes(kept.id, at(10))
    expect(
      notes
        .get()
        .map((each) => each.id)
        .sort(),
    ).toEqual([kept.id, written.id, 'elsewhere'].sort())
    // A day later, it's gone too.
    await tidyEmptyNotes(kept.id, new Date(at(10).getTime() + 25 * 3600_000))
    expect(notes.find('elsewhere')?.deletedAt).not.toBeNull()
  })
})
