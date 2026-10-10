import { getDb, indexedDbAvailable } from './db/db'
import {
  storeRegistry,
  type HydrationReport,
  type LegacyStorage,
  type StorageBackend,
} from './persistentStore'

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
      await (await getDb()).put('kv', value, key)
    },
    async remove(key) {
      await (await getDb()).delete('kv', key)
    },
    async writeMeta(key, value) {
      await (await getDb()).put('meta', value, key)
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
 * Loads every store before the app renders. Uses IndexedDB, migrating any
 * data older versions kept in localStorage; falls back to localStorage itself
 * if IndexedDB can't be opened (some private-browsing modes).
 */
export async function hydrateStores(): Promise<HydrationReport> {
  if (indexedDbAvailable()) {
    try {
      const backend = indexedDbBackend()
      await backend.readAll() // fail fast if the database can't open
      return await storeRegistry.hydrate(backend, legacyStorage())
    } catch (error) {
      console.warn(
        '[momentum] IndexedDB unavailable; using localStorage.',
        error,
      )
    }
  }
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
