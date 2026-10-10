import { isRecord } from './guards'
import type { Store } from './store'

export { useStore } from './store'

/** What gets stored: the data plus the schema version it was written with. */
export interface StoredEnvelope {
  version: number
  data: unknown
}

export function isEnvelope(value: unknown): value is StoredEnvelope {
  return isRecord(value) && typeof value.version === 'number' && 'data' in value
}

/** Where stores are persisted (IndexedDB in the app, memory in tests). */
export interface StorageBackend {
  readAll(): Promise<Map<string, unknown>>
  read(key: string): Promise<unknown>
  write(key: string, value: unknown): Promise<void>
  remove(key: string): Promise<void>
  writeMeta?(key: string, value: unknown): Promise<void>
}

/** The localStorage-shaped source that older versions of Momentum wrote to. */
export interface LegacyStorage {
  getItem(key: string): string | null
}

export function createMemoryBackend(
  initial: Record<string, unknown> = {},
): StorageBackend & {
  entries: Map<string, unknown>
  meta: Map<string, unknown>
} {
  const entries = new Map(Object.entries(initial))
  const meta = new Map<string, unknown>()
  return {
    entries,
    meta,
    readAll: async () => new Map(entries),
    read: async (key) => entries.get(key),
    write: async (key, value) => void entries.set(key, structuredClone(value)),
    remove: async (key) => void entries.delete(key),
    writeMeta: async (key, value) => void meta.set(key, value),
  }
}

export interface PersistentStoreOptions<T> {
  key: string
  /** Current schema version. Bump it for changes `parse` can't absorb. */
  version: number
  defaultValue: T
  /** Validates (and normalizes) data written at the current version. `null` if unusable. */
  parse: (data: unknown) => T | null
  /** Upgrades data written by an older version into the current shape (then `parse`d). */
  migrate?: (data: unknown, fromVersion: number) => unknown
  /** How a restored backup combines with what's here. Default: replace. */
  merge?: (current: T, incoming: T) => T
  registry?: StoreRegistry
}

export interface PersistentStore<T> extends Store<T> {
  readonly key: string
  reset(): void
  toEnvelope(): StoredEnvelope
  /** Decodes an envelope (e.g. from a backup), running migrations. `null` if invalid. */
  decode(envelope: unknown): T | null
  /** Applies data from a backup: merged if the store defines how, else replaced. */
  restore(value: T): void
}

interface RegisteredStore {
  key: string
  decode(raw: unknown): unknown
  apply(value: unknown): void
  envelope(): StoredEnvelope
  restoreFrom(raw: unknown): boolean
  /** Changed before hydration finished: keep this value. */
  dirty: boolean
}

export interface HydrationReport {
  loaded: string[]
  migrated: string[]
  unreadable: string[]
}

/**
 * Owns every persistent store: loads them all before the first render, writes
 * changes through to the backend (batched per tick), and keeps tabs in sync
 * with BroadcastChannel.
 */
export class StoreRegistry {
  private stores = new Map<string, RegisteredStore>()
  private backend: StorageBackend | null = null
  private pending = new Map<string, 'write' | 'remove'>()
  private flushQueued = false
  private flushing: Promise<void> = Promise.resolve()
  private channel: BroadcastChannel | null = null
  private loading = new Set<Promise<void>>()
  private readonly channelName?: string

  /** `channelName` enables cross-tab sync; omit it in tests. */
  constructor(channelName?: string) {
    this.channelName = channelName
  }

  register(store: RegisteredStore): void {
    if (this.stores.has(store.key)) {
      throw new Error(`[momentum] Two stores share the key "${store.key}".`)
    }
    this.stores.set(store.key, store)
    // A store from a lazily loaded page: load its saved value now.
    if (this.backend) {
      const loading = this.loadLate(store, this.backend).finally(() =>
        this.loading.delete(loading),
      )
      this.loading.add(loading)
    }
  }

  /** Resolves once stores registered after hydration have loaded their data. */
  async settled(): Promise<void> {
    await Promise.all(this.loading)
  }

  private async loadLate(
    store: RegisteredStore,
    backend: StorageBackend,
  ): Promise<void> {
    try {
      const raw = await backend.read(store.key)
      if (raw === undefined || store.dirty) return
      const value = store.decode(raw)
      if (value !== null) store.apply(value)
    } catch (error) {
      console.error(`[momentum] Could not load "${store.key}".`, error)
    }
  }

  keys(): string[] {
    return [...this.stores.keys()]
  }

  /** Envelopes for every registered store. */
  snapshot(): Record<string, StoredEnvelope> {
    return Object.fromEntries(
      [...this.stores.values()].map((store) => [store.key, store.envelope()]),
    )
  }

  /**
   * Everything saved, for a backup: the live value of every registered store,
   * plus saved data for stores whose code hasn't loaded this session (a page
   * that hasn't been opened yet).
   */
  async snapshotAll(): Promise<Record<string, StoredEnvelope>> {
    await this.flush()
    const saved = this.backend
      ? await this.backend.readAll()
      : new Map<string, unknown>()
    const result: Record<string, StoredEnvelope> = {}
    for (const [key, value] of saved) {
      if (isEnvelope(value)) result[key] = value
    }
    return { ...result, ...this.snapshot() }
  }

  /**
   * Restores one store from a backup envelope. Data for a store this session
   * hasn't loaded is saved as-is for when it does. False if it can't be used
   * (damaged, or from a newer version of a store).
   */
  async restore(key: string, envelope: unknown): Promise<boolean> {
    const store = this.stores.get(key)
    if (store) return store.restoreFrom(envelope)
    if (!isEnvelope(envelope) || !this.backend) return false
    await this.backend.write(key, envelope)
    this.channel?.postMessage({ keys: [key] })
    return true
  }

  /**
   * Loads every registered store from the backend. Data that only exists in
   * the legacy localStorage location is migrated across (the old copy is left
   * in place as a safety net).
   */
  async hydrate(
    backend: StorageBackend,
    legacy?: LegacyStorage,
  ): Promise<HydrationReport> {
    this.backend = backend
    const saved = await backend.readAll()
    const report: HydrationReport = { loaded: [], migrated: [], unreadable: [] }

    for (const store of this.stores.values()) {
      if (store.dirty) {
        this.schedule(store.key, 'write')
        continue
      }
      let raw = saved.get(store.key)
      let fromLegacy = false
      if (raw === undefined && legacy) {
        const text = safeGet(legacy, store.key)
        if (text !== null) {
          raw = safeParse(text)
          fromLegacy = true
        }
      }
      if (raw === undefined) continue

      const value = store.decode(raw)
      if (value === null) {
        // Keep unreadable data rather than overwriting it on the next save.
        report.unreadable.push(store.key)
        console.warn(
          `[momentum] Could not read "${store.key}"; kept a copy as "${store.key}.unreadable".`,
        )
        await backend.write(`${store.key}.unreadable`, raw).catch(() => {})
        continue
      }
      store.apply(value)
      if (fromLegacy) {
        report.migrated.push(store.key)
        this.schedule(store.key, 'write')
      } else {
        report.loaded.push(store.key)
      }
    }

    if (report.migrated.length > 0) {
      await backend
        .writeMeta?.('migration:localStorage', {
          at: new Date().toISOString(),
          keys: report.migrated,
        })
        .catch(() => {})
    }
    this.listen()
    await this.flush()
    return report
  }

  private changeListeners = new Set<(key: string) => void>()

  /** Hears about every change made in this tab (sync uses it). */
  onChange(listener: (key: string) => void): () => void {
    this.changeListeners.add(listener)
    return () => this.changeListeners.delete(listener)
  }

  schedule(key: string, operation: 'write' | 'remove'): void {
    this.pending.set(key, operation)
    for (const listener of this.changeListeners) listener(key)
    if (!this.backend || this.flushQueued) return // Written once hydration has picked a backend.
    // Changes made together are written together, straight after the code
    // that made them: soon enough that leaving the page doesn't lose them.
    this.flushQueued = true
    queueMicrotask(() => {
      this.flushQueued = false
      void this.flush()
    })
  }

  /** Writes pending changes now. Resolves when they're saved. */
  flush(): Promise<void> {
    this.flushing = this.flushing.then(() => this.writePending())
    return this.flushing
  }

  private async writePending(): Promise<void> {
    const backend = this.backend
    if (!backend || this.pending.size === 0) return
    const batch = [...this.pending]
    this.pending.clear()
    const written: string[] = []
    for (const [key, operation] of batch) {
      const store = this.stores.get(key)
      try {
        if (operation === 'remove') await backend.remove(key)
        else if (store) await backend.write(key, store.envelope())
        written.push(key)
      } catch (error) {
        console.error(`[momentum] Could not save "${key}".`, error)
      }
    }
    if (written.length > 0) this.channel?.postMessage({ keys: written })
  }

  private listen(): void {
    if (
      !this.channelName ||
      typeof BroadcastChannel === 'undefined' ||
      this.channel
    )
      return
    this.channel = new BroadcastChannel(this.channelName)
    // Another tab saved: reload those stores from the backend.
    this.channel.onmessage = async (
      event: MessageEvent<{ keys?: string[] }>,
    ) => {
      for (const key of event.data.keys ?? []) {
        const store = this.stores.get(key)
        if (!store || !this.backend) continue
        const raw = await this.backend.read(key)
        const value = raw === undefined ? undefined : store.decode(raw)
        if (raw === undefined) store.restoreFrom(undefined)
        else if (value !== null) store.apply(value)
      }
    }
  }
}

function safeGet(storage: LegacyStorage, key: string): string | null {
  try {
    return storage.getItem(key)
  } catch {
    return null
  }
}

function safeParse(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

/** The app's stores. Tests create their own registries. */
export const storeRegistry = new StoreRegistry('momentum-stores')

export function createPersistentStore<T>(
  options: PersistentStoreOptions<T>,
): PersistentStore<T> {
  const { key, version, defaultValue, parse, migrate, merge } = options
  const registry = options.registry ?? storeRegistry
  const listeners = new Set<() => void>()
  let state = defaultValue
  let hydrated = false

  function decode(envelope: unknown): T | null {
    if (!isEnvelope(envelope)) return null
    if (envelope.version === version) return parse(envelope.data)
    if (envelope.version < version && migrate) {
      return parse(migrate(envelope.data, envelope.version))
    }
    return null
  }

  function emit() {
    for (const listener of listeners) listener()
  }

  function set(next: T | ((previous: T) => T)) {
    const value =
      typeof next === 'function' ? (next as (previous: T) => T)(state) : next
    if (Object.is(value, state)) return
    state = value
    if (!hydrated) internal.dirty = true
    registry.schedule(key, 'write')
    emit()
  }

  const internal: RegisteredStore = {
    key,
    dirty: false,
    decode,
    apply(value) {
      hydrated = true
      state = value as T
      emit()
    },
    envelope: () => ({ version, data: state }),
    restoreFrom(raw) {
      if (raw === undefined) {
        state = defaultValue
        emit()
        return true
      }
      const value = decode(raw)
      if (value === null) return false
      store.restore(value)
      return true
    },
  }
  registry.register(internal)

  const store: PersistentStore<T> = {
    key,
    get: () => state,
    set,
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    reset() {
      state = defaultValue
      registry.schedule(key, 'remove')
      emit()
    },
    toEnvelope: () => ({ version, data: state }),
    decode,
    restore(value) {
      set(merge ? merge(state, value) : value)
    },
  }
  return store
}
