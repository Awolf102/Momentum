import type { DBSchema, IDBPDatabase } from 'idb'

/**
 * Momentum's IndexedDB schema. Bump `DB_VERSION` and add a step to `upgrade`
 * whenever an object store or index is added; steps run in order, so a
 * browser on any older version is brought up to date.
 */
export const DB_NAME = 'momentum'
export const DB_VERSION = 11

/** Object stores that hold collections (see `lib/collection.ts`). */
export const COLLECTION_STORES = [
  'focusSessions',
  'logEntries',
  'tasks',
  'habitCheckIns',
  'routineRuns',
  'inboxItems',
  'notes',
  'documents',
  'highlights',
] as const
export type CollectionStoreName = (typeof COLLECTION_STORES)[number]

export interface MomentumDB extends DBSchema {
  /** Uploaded photos (Blobs), keyed `<id>:full` / `<id>:thumb`. */
  photos: { key: string; value: Blob }
  /** Persistent stores, keyed by store name, holding `{ version, data }`. */
  kv: { key: string; value: unknown }
  /** API keys and other secrets — never exported unless the user opts in. */
  secrets: { key: string; value: string }
  /** Bookkeeping, e.g. when data was migrated from localStorage. */
  meta: { key: string; value: unknown }
  /** Completed focus sessions, one record each (see `features/focus`). */
  focusSessions: {
    key: string
    value: {
      id: string
      day: string
      subjectId: string | null
      [field: string]: unknown
    }
    indexes: { 'by-day': string; 'by-subject': string }
  }
  /** One line per day, keyed by the day (see `features/log`). */
  logEntries: {
    key: string
    value: { id: string; day: string; text: string; [field: string]: unknown }
  }
  /** Tasks, one record each (see `features/tasks`). */
  tasks: {
    key: string
    value: {
      id: string
      due: string | null
      status: string
      subjectId: string | null
      [field: string]: unknown
    }
    indexes: { 'by-due': string; 'by-status': string; 'by-subject': string }
  }
  /** One record per habit per day it was done (see `features/habits`). */
  habitCheckIns: {
    key: string
    value: {
      id: string
      habitId: string
      day: string
      [field: string]: unknown
    }
    indexes: { 'by-habit': string; 'by-day': string }
  }
  /** A routine's steps done on a day (see `features/routines`). */
  routineRuns: {
    key: string
    value: {
      id: string
      routineId: string
      day: string
      [field: string]: unknown
    }
    indexes: { 'by-routine': string; 'by-day': string }
  }
  /** Things captured to sort later (see `features/inbox`). */
  inboxItems: {
    key: string
    value: { id: string; text: string; [field: string]: unknown }
  }
  /** Notes in markdown (see `features/notes`). */
  notes: {
    key: string
    value: {
      id: string
      title: string
      subjectId: string | null
      [field: string]: unknown
    }
    indexes: { 'by-subject': string }
  }
  /** PDFs in the library (see `features/library`); files are kept apart. */
  documents: {
    key: string
    value: {
      id: string
      title: string
      subjectId: string | null
      [field: string]: unknown
    }
    indexes: { 'by-subject': string }
  }
  /** Highlights and margin notes in documents. */
  highlights: {
    key: string
    value: { id: string; documentId: string; [field: string]: unknown }
    indexes: { 'by-document': string }
  }
  /** Each document's file, keyed by the document's id. */
  documentFiles: { key: string; value: Blob }
  /** Each document's text, one string per page, for search. */
  documentTexts: { key: string; value: string[] }
  /**
   * The search-by-meaning index, one record per note or document (keyed
   * `note:<id>` / `document:<id>`): what it was made from…
   */
  embeddingSources: {
    key: string
    value: {
      key: string
      hash: string
      space: string
      [field: string]: unknown
    }
  }
  /** …and its passages with their vectors. Rebuilt, never backed up. */
  embeddingVectors: {
    key: string
    value: { key: string; [field: string]: unknown }
  }
}

export function upgrade(
  db: IDBPDatabase<MomentumDB>,
  oldVersion: number,
): void {
  // v1: created by v1/v2 of the app (via idb-keyval) for uploaded photos.
  if (oldVersion < 1) db.createObjectStore('photos')
  // v2: Version 3 Phase 1 — stores move from localStorage to IndexedDB.
  if (oldVersion < 2) {
    db.createObjectStore('kv')
    db.createObjectStore('secrets')
    db.createObjectStore('meta')
  }
  // v3: the focus timer. Sessions get their own store, indexed so totals per
  // day and per subject (future streak categories) need no migration.
  if (oldVersion < 3) {
    const sessions = db.createObjectStore('focusSessions', { keyPath: 'id' })
    sessions.createIndex('by-day', 'day')
    sessions.createIndex('by-subject', 'subjectId')
  }
  // v4: the daily log. A record's id is its day, so one line per day is
  // guaranteed by the store itself.
  if (oldVersion < 4) db.createObjectStore('logEntries', { keyPath: 'id' })
  // v5: tasks, indexed for the planner and analytics to come.
  if (oldVersion < 5) {
    const tasks = db.createObjectStore('tasks', { keyPath: 'id' })
    tasks.createIndex('by-due', 'due')
    tasks.createIndex('by-status', 'status')
    tasks.createIndex('by-subject', 'subjectId')
  }
  // v6: habits beyond the daily check-in. Their check-ins, one per habit per
  // day (the id is "<habit>:<day>").
  if (oldVersion < 6) {
    const checkIns = db.createObjectStore('habitCheckIns', { keyPath: 'id' })
    checkIns.createIndex('by-habit', 'habitId')
    checkIns.createIndex('by-day', 'day')
  }
  // v7: routines. Each day's run through one (the id is "<routine>:<day>").
  if (oldVersion < 7) {
    const runs = db.createObjectStore('routineRuns', { keyPath: 'id' })
    runs.createIndex('by-routine', 'routineId')
    runs.createIndex('by-day', 'day')
  }
  // v8: the quick-capture inbox.
  if (oldVersion < 8) db.createObjectStore('inboxItems', { keyPath: 'id' })
  // v9: notes.
  if (oldVersion < 9) {
    const notes = db.createObjectStore('notes', { keyPath: 'id' })
    notes.createIndex('by-subject', 'subjectId')
  }
  // v10: the document library. Records (documents, highlights) are
  // collections; files and their text are kept apart, out of memory.
  if (oldVersion < 10) {
    const documents = db.createObjectStore('documents', { keyPath: 'id' })
    documents.createIndex('by-subject', 'subjectId')
    const highlights = db.createObjectStore('highlights', { keyPath: 'id' })
    highlights.createIndex('by-document', 'documentId')
    db.createObjectStore('documentFiles')
    db.createObjectStore('documentTexts')
  }
  // v11: search by meaning. What each entry was made from is kept apart from
  // its vectors, so checking what's changed doesn't read every vector.
  if (oldVersion < 11) {
    db.createObjectStore('embeddingSources', { keyPath: 'key' })
    db.createObjectStore('embeddingVectors', { keyPath: 'key' })
  }
}
