import { collectionRegistry, type CollectionBackend } from './collection'
import { getDb, indexedDbAvailable } from './db/db'
import type { CollectionStoreName } from './db/schema'
import {
  storeRegistry,
  type HydrationReport,
  type LegacyStorage,
  type StorageBackend,
} from './persistentStore'

/**
 * Asks for a transaction's commit straight away, instead of after the page
 * hears back from each request: a change made just before the page closes or
 * reloads (start a timer, then navigate) still lands.
 */
function commitNow(tx: { commit?: () => void }): void {
  try {
    tx.commit?.()
  } catch {
    // Already committing.
  }
}

/** Persistent stores in IndexedDB's `kv` object store. */
export function indexedDbBackend(): StorageBackend {
  return {
    async readAll() {
      const db = await getDb()
      const tx = db.transaction('kv')
      const [keys, values] = await Promise.all([
        tx.store.getAllKeys(),
        tx.store.getAll(),
      ])
      return new Map(keys.map((key, index) => [key, values[index]]))
    },
    async read(key) {
      return (await getDb()).get('kv', key)
    },
    async write(key, value) {
      const tx = (await getDb()).transaction('kv', 'readwrite')
      const done = Promise.all([tx.store.put(value, key), tx.done])
      commitNow(tx)
      await done
    },
    async remove(key) {
      const tx = (await getDb()).transaction('kv', 'readwrite')
      const done = Promise.all([tx.store.delete(key), tx.done])
      commitNow(tx)
      await done
    },
    async writeMeta(key, value) {
      await (await getDb()).put('meta', value, key)
    },
  }
}

/** Collections, each in its own IndexedDB object store. */
export function indexedDbCollectionBackend(): CollectionBackend {
  const store = (name: string) => name as CollectionStoreName
  return {
    getAll: async (name) => (await getDb()).getAll(store(name)),
    get: async (name, id) => (await getDb()).get(store(name), id),
    async put(name, record) {
      const tx = (await getDb()).transaction(store(name), 'readwrite')
      const done = Promise.all([tx.store.put(record as never), tx.done])
      commitNow(tx)
      await done
    },
    async add(name, record) {
      const tx = (await getDb()).transaction(store(name), 'readwrite')
      const done = Promise.all([tx.store.add(record as never), tx.done])
      commitNow(tx)
      try {
        await done
        return true
      } catch (error) {
        // Already there (perhaps written by another tab a moment ago).
        if (error instanceof DOMException && error.name === 'ConstraintError')
          return false
        throw error
      }
    },
    async clear(name) {
      await (await getDb()).clear(store(name))
    },
  }
}

/** Last resort when IndexedDB is unavailable: the old localStorage format. */
function localStorageBackend(): StorageBackend {
  const read = (key: string) => {
    const text = localStorage.getItem(key)
    return text === null ? undefined : JSON.parse(text)
  }
  return {
    async readAll() {
      const entries = new Map<string, unknown>()
      for (let index = 0; index < localStorage.length; index++) {
        const key = localStorage.key(index)
        if (key?.startsWith('momentum.')) entries.set(key, read(key))
      }
      return entries
    },
    read: async (key) => read(key),
    write: async (key, value) =>
      localStorage.setItem(key, JSON.stringify(value)),
    remove: async (key) => localStorage.removeItem(key),
  }
}

function legacyStorage(): LegacyStorage | undefined {
  try {
    return window.localStorage
  } catch {
    return undefined
  }
}

/**
 * Loads every store and collection before the app renders. Uses IndexedDB,
 * migrating any data older versions kept in localStorage; falls back to
 * localStorage itself if IndexedDB can't be opened (some private modes).
 */
export async function hydrateStores(): Promise<HydrationReport> {
  if (indexedDbAvailable()) {
    let report: HydrationReport | undefined
    try {
      const backend = indexedDbBackend()
      await backend.readAll() // fail fast if the database can't open
      report = await storeRegistry.hydrate(backend, legacyStorage())
    } catch (error) {
      console.warn(
        '[momentum] IndexedDB unavailable; using localStorage.',
        error,
      )
    }
    if (report) {
      await collectionRegistry.hydrate(indexedDbCollectionBackend())
      return report
    }
  }
  // Collections need IndexedDB; without it they last for this session.
  await collectionRegistry.hydrate(null)
  try {
    return await storeRegistry.hydrate(localStorageBackend())
  } catch {
    console.warn(
      '[momentum] No storage available; progress will only last this session.',
    )
    return { loaded: [], migrated: [], unreadable: [] }
  }
}

/** Asks the browser not to evict Momentum's data under storage pressure. */
export async function requestPersistentStorage(): Promise<boolean> {
  try {
    return (await navigator.storage?.persist?.()) ?? false
  } catch {
    return false
  }
}
