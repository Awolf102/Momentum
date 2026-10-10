import { createStore } from './store'

/** Fields every collection record carries (for history, sync and merging). */
export interface CollectionRecord {
  id: string
  createdAt: string
  updatedAt: string
  /** Soft delete: the record is kept so history and future sync see it. */
  deletedAt?: string | null
}

/** Where collections keep their records (IndexedDB in the app, memory in tests). */
export interface CollectionBackend {
  getAll(name: string): Promise<unknown[]>
  get(name: string, id: string): Promise<unknown>
  put(name: string, record: CollectionRecord): Promise<void>
  /** Writes the record unless one with its id exists. Atomic across tabs. */
  add(name: string, record: CollectionRecord): Promise<boolean>
  clear(name: string): Promise<void>
}

export function createMemoryCollectionBackend(): CollectionBackend & {
  tables: Map<string, Map<string, CollectionRecord>>
} {
  const tables = new Map<string, Map<string, CollectionRecord>>()
  const table = (name: string) => {
    let rows = tables.get(name)
    if (!rows) tables.set(name, (rows = new Map()))
    return rows
  }
  return {
    tables,
    getAll: async (name) =>
      [...table(name).values()].map((row) => structuredClone(row)),
    get: async (name, id) => structuredClone(table(name).get(id)),
    put: async (name, record) =>
      void table(name).set(record.id, structuredClone(record)),
    async add(name, record) {
      if (table(name).has(record.id)) return false
      table(name).set(record.id, structuredClone(record))
      return true
    },
    clear: async (name) => table(name).clear(),
  }
}

interface RegisteredCollection {
  name: string
  load(records: unknown[]): void
  upsert(raw: unknown, id: string): void
}

function isRecordLike(value: unknown): value is CollectionRecord {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as CollectionRecord).id === 'string' &&
    typeof (value as CollectionRecord).updatedAt === 'string'
  )
}

/**
 * Owns every collection: loads them before the first render, gives them a
 * backend, keeps tabs in sync over BroadcastChannel, and reads and writes
 * whole collections for backups.
 */
export class CollectionRegistry {
  private collections = new Map<string, RegisteredCollection>()
  private channel: BroadcastChannel | null = null
  private loading = new Set<Promise<void>>()
  private readonly channelName?: string
  backend: CollectionBackend | null = null
  hydrated = false

  constructor(channelName?: string) {
    this.channelName = channelName
  }

  register(collection: RegisteredCollection): void {
    if (this.collections.has(collection.name)) {
      throw new Error(
        `[momentum] Two collections are called "${collection.name}".`,
      )
    }
    this.collections.set(collection.name, collection)
    // Created by a lazily loaded page: load it now.
    if (this.hydrated && this.backend) {
      const loading = this.load(collection, this.backend).finally(() =>
        this.loading.delete(loading),
      )
      this.loading.add(loading)
    }
  }

  private async load(
    collection: RegisteredCollection,
    backend: CollectionBackend,
  ) {
    try {
      collection.load(await backend.getAll(collection.name))
    } catch (error) {
      console.error(`[momentum] Could not load "${collection.name}".`, error)
    }
  }

  /** Loads every registered collection. Without a backend they live in memory. */
  async hydrate(backend: CollectionBackend | null): Promise<void> {
    this.backend = backend
    if (backend)
      await Promise.all(
        [...this.collections.values()].map((c) => this.load(c, backend)),
      )
    this.hydrated = true
    this.listen()
  }

  /** Resolves once collections registered after hydration have loaded. */
  async settled(): Promise<void> {
    await Promise.all(this.loading)
  }

  private changeListeners = new Set<(name: string) => void>()

  /** Hears about every change made in this tab (sync uses it). */
  onChange(listener: (name: string) => void): () => void {
    this.changeListeners.add(listener)
    return () => this.changeListeners.delete(listener)
  }

  announce(name: string, change: { ids?: string[]; cleared?: boolean }): void {
    this.channel?.postMessage({ name, ...change })
    for (const listener of this.changeListeners) listener(name)
  }

  private listen() {
    if (
      !this.channelName ||
      typeof BroadcastChannel === 'undefined' ||
      this.channel
    )
      return
    this.channel = new BroadcastChannel(this.channelName)
    this.channel.onmessage = async (
      event: MessageEvent<{ name?: string; ids?: string[]; cleared?: boolean }>,
    ) => {
      const { name, ids, cleared } = event.data
      const collection = name ? this.collections.get(name) : undefined
      if (!collection || !this.backend) return
      if (cleared || !ids) {
        await this.load(collection, this.backend)
        return
      }
      for (const id of ids)
        collection.upsert(await this.backend.get(collection.name, id), id)
    }
  }

  /** Every record (deleted ones included) of the named collections, for a backup. */
  async exportAll(
    names: readonly string[],
  ): Promise<Record<string, CollectionRecord[]>> {
    const result: Record<string, CollectionRecord[]> = {}
    for (const name of names) {
      const rows = this.backend ? await this.backend.getAll(name) : []
      result[name] = rows.filter(isRecordLike)
    }
    return result
  }

  /**
   * Merges records from a backup: new ones are added and newer versions
   * replace older ones, so restoring never undoes later changes. Returns
   * how many records it added or updated, leaving out deletions.
   */
  async importRecords(
    name: string,
    records: readonly unknown[],
  ): Promise<number> {
    const backend = this.backend
    if (!backend) return 0
    let changed = 0
    const ids: string[] = []
    for (const record of records) {
      if (!isRecordLike(record)) continue
      const existing = await backend.get(name, record.id)
      if (isRecordLike(existing) && existing.updatedAt >= record.updatedAt)
        continue
      await backend.put(name, record)
      ids.push(record.id)
      // Deletions are carried over too, but only what you can see is counted.
      if (!record.deletedAt) changed++
    }
    const collection = this.collections.get(name)
    if (collection) await this.load(collection, backend)
    if (ids.length > 0) this.announce(name, { ids })
    return changed
  }
}

export const collectionRegistry = new CollectionRegistry('momentum-collections')

export interface Collection<T extends CollectionRecord> {
  readonly name: string
  /** Live records (soft-deleted ones left out), oldest first. */
  get(): readonly T[]
  subscribe(listener: () => void): () => void
  find(id: string): T | undefined
  /** Adds a new record. False if one with this id exists (e.g. another tab added it). */
  add(record: T): Promise<boolean>
  /** Adds or replaces a record. */
  put(record: T): Promise<void>
  /** Soft-deletes a record. */
  remove(id: string, now?: Date): Promise<void>
  /** Permanently deletes every record ("start over"). */
  clear(): Promise<void>
}

export interface CollectionOptions<T> {
  /** The IndexedDB object store (declared in `lib/db/schema.ts`). */
  name: string
  /** Validates a record read from storage or a backup. `null` if unusable. */
  parse: (value: unknown) => T | null
  registry?: CollectionRegistry
}

/**
 * A list of records kept in its own IndexedDB object store, written one
 * record at a time and readable synchronously (and from React via
 * `useStore`). For data that grows, like focus sessions.
 */
export function createCollection<T extends CollectionRecord>(
  options: CollectionOptions<T>,
): Collection<T> {
  const { name, parse } = options
  const registry = options.registry ?? collectionRegistry
  const all = new Map<string, T>()
  const live = createStore<readonly T[]>([])

  function publish() {
    live.set(
      [...all.values()]
        .filter((record) => !record.deletedAt)
        .sort((a, b) =>
          a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0,
        ),
    )
  }

  registry.register({
    name,
    load(records) {
      all.clear()
      for (const raw of records) {
        const record = parse(raw)
        if (record) all.set(record.id, record)
      }
      publish()
    },
    upsert(raw, id) {
      const record = raw === undefined ? null : parse(raw)
      if (record) all.set(record.id, record)
      else all.delete(id)
      publish()
    },
  })

  async function write(record: T) {
    all.set(record.id, record)
    publish()
    try {
      await registry.backend?.put(name, record)
      registry.announce(name, { ids: [record.id] })
    } catch (error) {
      console.error(`[momentum] Could not save to "${name}".`, error)
    }
  }

  return {
    name,
    get: live.get,
    subscribe: live.subscribe,
    find: (id) => all.get(id),
    async add(record) {
      const backend = registry.backend
      if (!backend) {
        if (all.has(record.id)) return false
        all.set(record.id, record)
        publish()
        return true
      }
      const added = await backend.add(name, record)
      if (added) {
        all.set(record.id, record)
        publish()
        registry.announce(name, { ids: [record.id] })
      } else {
        // Another tab got there first: take its copy.
        const existing = parse(await backend.get(name, record.id))
        if (existing) all.set(existing.id, existing)
        publish()
      }
      return added
    },
    put: (record) => write(record),
    async remove(id, now = new Date()) {
      const record = all.get(id)
      if (!record || record.deletedAt) return
      const stamp = now.toISOString()
      await write({ ...record, deletedAt: stamp, updatedAt: stamp })
    },
    async clear() {
      all.clear()
      publish()
      try {
        await registry.backend?.clear(name)
        registry.announce(name, { cleared: true })
      } catch (error) {
        console.error(`[momentum] Could not clear "${name}".`, error)
      }
    },
  }
}
