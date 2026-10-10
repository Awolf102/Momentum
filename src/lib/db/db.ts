import { openDB, type IDBPDatabase } from 'idb'
import { DB_NAME, DB_VERSION, upgrade, type MomentumDB } from './schema'

/**
 * What happens to the database because of another tab:
 * - `blocked`: this tab needs to upgrade it, but an older tab is still using
 *   it. The upgrade (and so the app) waits until that tab closes.
 * - `outdated`: a newer version in another tab upgraded it. This tab's
 *   connection is closed so the upgrade can go ahead; it should reload.
 */
export type DbEvent = 'blocked' | 'outdated'

const listeners = new Set<(event: DbEvent) => void>()

export function onDbEvent(listener: (event: DbEvent) => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function emit(event: DbEvent) {
  for (const listener of listeners) listener(event)
}

let connection: Promise<IDBPDatabase<MomentumDB>> | null = null

/** The shared database connection, opened (and upgraded) on first use. */
export function getDb(): Promise<IDBPDatabase<MomentumDB>> {
  connection ??= openDB<MomentumDB>(DB_NAME, DB_VERSION, {
    upgrade,
    blocked() {
      emit('blocked')
    },
    blocking(_current, _blocked, event) {
      ;(event.target as IDBDatabase).close()
      connection = null
      emit('outdated')
    },
    terminated() {
      connection = null
    },
  })
  return connection
}

/** For tests: forget the cached connection. */
export async function closeDb(): Promise<void> {
  const open = connection
  connection = null
  if (open) (await open).close()
}

export function indexedDbAvailable(): boolean {
  return typeof indexedDB !== 'undefined'
}
