import { isRecord } from './guards'
import type { Store } from './store'

export { useStore } from './store'

/** The subset of the Web Storage API a store needs — swappable for tests or a remote backend. */
export interface StorageDriver {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

export function createMemoryStorage(): StorageDriver {
  const items = new Map<string, string>()
  return {
    getItem: (key) => items.get(key) ?? null,
    setItem: (key, value) => void items.set(key, value),
    removeItem: (key) => void items.delete(key),
  }
}

let defaultStorage: StorageDriver | undefined

/** `localStorage` when it's usable, otherwise an in-memory fallback (e.g. some private-browsing modes). */
export function getDefaultStorage(): StorageDriver {
  if (defaultStorage) return defaultStorage
  try {
    const probe = '__momentum_probe__'
    window.localStorage.setItem(probe, probe)
    window.localStorage.removeItem(probe)
    defaultStorage = window.localStorage
  } catch {
    console.warn(
      '[momentum] localStorage is unavailable; progress will only last this session.',
    )
    defaultStorage = createMemoryStorage()
  }
  return defaultStorage
}

/** What actually gets written: the data plus the schema version it was written with. */
export interface StoredEnvelope {
  version: number
  data: unknown
}

function isEnvelope(value: unknown): value is StoredEnvelope {
  return isRecord(value) && typeof value.version === 'number' && 'data' in value
}

export interface PersistentStoreOptions<T> {
  key: string
  /** Current schema version. Bump it whenever the shape of `T` changes. */
  version: number
  defaultValue: T
  /** Validates (and normalizes) data written at the current version. Return `null` if unusable. */
  parse: (data: unknown) => T | null
  /** Upgrades data written by an older version into the current shape (it is then `parse`d). */
  migrate?: (data: unknown, fromVersion: number) => unknown
  storage?: StorageDriver
}

export interface PersistentStore<T> extends Store<T> {
  readonly key: string
  reset(): void
  toEnvelope(): StoredEnvelope
  /** Decodes an envelope (e.g. from a backup file), running migrations. `null` if invalid. */
  decode(envelope: unknown): T | null
}

export function createPersistentStore<T>(
  options: PersistentStoreOptions<T>,
): PersistentStore<T> {
  const { key, version, defaultValue, parse, migrate } = options
  const storage = options.storage ?? getDefaultStorage()
  const listeners = new Set<() => void>()

  function decode(envelope: unknown): T | null {
    if (!isEnvelope(envelope)) return null
    if (envelope.version === version) return parse(envelope.data)
    if (envelope.version < version && migrate) {
      return parse(migrate(envelope.data, envelope.version))
    }
    return null
  }

  function load(): T {
    const raw = storage.getItem(key)
    if (raw === null) return defaultValue

    let value: T | null = null
    try {
      value = decode(JSON.parse(raw))
    } catch {
      value = null
    }
    if (value !== null) return value

    // Keep unreadable data rather than silently overwriting it on the next save.
    console.warn(
      `[momentum] Could not read "${key}"; a copy was kept as "${key}.unreadable".`,
    )
    try {
      storage.setItem(`${key}.unreadable`, raw)
    } catch {
      // Storage is full or unavailable; nothing more we can do.
    }
    return defaultValue
  }

  let state = load()

  function emit() {
    for (const listener of listeners) listener()
  }

  function set(next: T | ((previous: T) => T)) {
    const value =
      typeof next === 'function' ? (next as (previous: T) => T)(state) : next
    if (Object.is(value, state)) return
    state = value
    try {
      storage.setItem(
        key,
        JSON.stringify({ version, data: value } satisfies StoredEnvelope),
      )
    } catch (error) {
      console.error(`[momentum] Could not save "${key}".`, error)
    }
    emit()
  }

  function reset() {
    state = defaultValue
    storage.removeItem(key)
    emit()
  }

  // Keep tabs in sync: when another tab writes this key, reload it here.
  if (typeof window !== 'undefined') {
    window.addEventListener('storage', (event) => {
      if (event.key !== key && event.key !== null) return
      state = load()
      emit()
    })
  }

  return {
    key,
    get: () => state,
    set,
    reset,
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    toEnvelope: () => ({ version, data: state }),
    decode,
  }
}
