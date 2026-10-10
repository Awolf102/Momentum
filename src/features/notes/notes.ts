import { createCollection } from '@/lib/collection'
import { isRecord } from '@/lib/guards'
import { createId } from '@/lib/id'
import { extractLinks, normalizeTitle, renameLinks } from './lib/links'
import type { Note } from './types'

export const MAX_TITLE_LENGTH = 120
export const MAX_BODY_LENGTH = 100_000

export function parseNote(value: unknown): Note | null {
  if (!isRecord(value)) return null
  const { id, title, body, subjectId, pinned, createdAt, updatedAt } = value
  if (typeof id !== 'string' || typeof createdAt !== 'string') return null
  if (typeof updatedAt !== 'string') return null
  return {
    id,
    title: typeof title === 'string' ? title.slice(0, MAX_TITLE_LENGTH) : '',
    body: typeof body === 'string' ? body.slice(0, MAX_BODY_LENGTH) : '',
    subjectId: typeof subjectId === 'string' ? subjectId : null,
    pinned: pinned === true,
    createdAt,
    updatedAt,
    deletedAt: typeof value.deletedAt === 'string' ? value.deletedAt : null,
  }
}

/** Every note, one record each. */
export const notes = createCollection<Note>({ name: 'notes', parse: parseNote })

/** Notes started in this tab, which it may tidy away if left empty. */
const startedHere = new Set<string>()

/** The note a [[link]] means: same title, ignoring case and spacing. */
export function findByTitle(title: string): Note | undefined {
  const wanted = normalizeTitle(title)
  if (!wanted) return undefined
  return notes
    .get()
    .filter((note) => normalizeTitle(note.title) === wanted)
    .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1))[0]
}

export async function createNote(
  input: { title?: string; body?: string; subjectId?: string | null } = {},
  now: Date = new Date(),
): Promise<Note> {
  const stamp = now.toISOString()
  const note: Note = {
    id: createId(),
    title: (input.title ?? '').trim().slice(0, MAX_TITLE_LENGTH),
    body: (input.body ?? '').slice(0, MAX_BODY_LENGTH),
    subjectId: input.subjectId ?? null,
    pinned: false,
    createdAt: stamp,
    updatedAt: stamp,
    deletedAt: null,
  }
  await notes.add(note)
  startedHere.add(note.id)
  return note
}

export type NoteChanges = Partial<
  Pick<Note, 'title' | 'body' | 'subjectId' | 'pinned'>
>

/**
 * Saves changes to a note. A new title is carried into other notes' links
 * to it, so renaming never breaks a link.
 */
export async function saveNote(
  id: string,
  changes: NoteChanges,
  now: Date = new Date(),
): Promise<void> {
  const note = notes.find(id)
  if (!note || note.deletedAt) return
  const next: Note = {
    ...note,
    ...changes,
    title: (changes.title ?? note.title).trim().slice(0, MAX_TITLE_LENGTH),
    body: (changes.body ?? note.body).slice(0, MAX_BODY_LENGTH),
  }
  const unchanged =
    next.title === note.title &&
    next.body === note.body &&
    next.subjectId === note.subjectId &&
    next.pinned === note.pinned
  if (unchanged) return
  const stamp = now.toISOString()
  await notes.put({ ...next, updatedAt: stamp })

  const renamed =
    note.title.trim() &&
    next.title &&
    normalizeTitle(note.title) !== normalizeTitle(next.title)
  if (!renamed) return
  for (const other of notes.get()) {
    if (other.id === id) continue
    const linksHere = extractLinks(other.body).some(
      (link) =>
        link.kind === 'note' &&
        normalizeTitle(link.target) === normalizeTitle(note.title),
    )
    if (!linksHere) continue
    await notes.put({
      ...other,
      body: renameLinks(other.body, note.title, next.title),
      updatedAt: stamp,
    })
  }
}

export async function deleteNote(id: string, now: Date = new Date()) {
  await notes.remove(id, now)
}

/** Brings back a deleted note ("Undo"). */
export async function restoreNote(id: string, now: Date = new Date()) {
  const note = notes.find(id)
  if (!note?.deletedAt) return
  await notes.put({ ...note, deletedAt: null, updatedAt: now.toISOString() })
}

/** Pinned notes first, then the most recently changed. */
export function sortNotes(list: readonly Note[]): Note[] {
  return [...list].sort((a, b) =>
    a.pinned !== b.pinned
      ? a.pinned
        ? -1
        : 1
      : a.updatedAt < b.updatedAt
        ? 1
        : a.updatedAt > b.updatedAt
          ? -1
          : 0,
  )
}

/** A note with nothing in it yet. */
export const isEmptyNote = (note: Note) =>
  !note.title.trim() && !note.body.trim()

const DAY_MS = 24 * 60 * 60 * 1000

/**
 * Deletes notes left empty: ones started in this tab and since moved on
 * from, and any untouched for a day (another tab may still be writing a
 * newer one).
 */
export async function tidyEmptyNotes(
  keepId: string | undefined,
  now: Date = new Date(),
): Promise<void> {
  for (const note of notes.get()) {
    if (note.id === keepId || !isEmptyNote(note)) continue
    const stale = now.getTime() - Date.parse(note.updatedAt) > DAY_MS
    if (startedHere.has(note.id) || stale) await deleteNote(note.id, now)
  }
}
