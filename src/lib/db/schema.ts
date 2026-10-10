import type { DBSchema, IDBPDatabase } from 'idb'

/**
 * Momentum's IndexedDB schema. Bump `DB_VERSION` and add a step to `upgrade`
 * whenever an object store or index is added; steps run in order, so a
 * browser on any older version is brought up to date.
 */
export const DB_NAME = 'momentum'
export const DB_VERSION = 2

export interface MomentumDB extends DBSchema {
  /** Uploaded photos (Blobs), keyed `<id>:full` / `<id>:thumb`. */
  photos: { key: string; value: Blob }
  /** Persistent stores, keyed by store name, holding `{ version, data }`. */
  kv: { key: string; value: unknown }
  /** API keys and other secrets — never exported unless the user opts in. */
  secrets: { key: string; value: string }
  /** Bookkeeping, e.g. when data was migrated from localStorage. */
  meta: { key: string; value: unknown }
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
}
