import 'fake-indexeddb/auto'
import { describe, expect, it, vi } from 'vitest'
import {
  createMemoryBackend,
  createPersistentStore,
  StoreRegistry,
  type LegacyStorage,
} from './persistentStore'

interface Counter {
  count: number
}

const parse = (data: unknown): Counter | null =>
  typeof data === 'object' &&
  data !== null &&
  typeof (data as Counter).count === 'number'
    ? { count: (data as Counter).count }
    : null

function setup(options: { merge?: (a: Counter, b: Counter) => Counter } = {}) {
  const registry = new StoreRegistry()
  const store = createPersistentStore<Counter>({
    key: 'test',
    version: 2,
    defaultValue: { count: 0 },
    parse,
    migrate: (data, fromVersion) =>
      fromVersion === 1 ? { count: (data as { total: number }).total } : null,
    registry,
    ...options,
  })
  return { registry, store }
}

const legacy = (items: Record<string, string>): LegacyStorage => ({
  getItem: (key) => items[key] ?? null,
})

describe('persistent stores', () => {
  it('starts from the default value', () => {
    expect(setup().store.get()).toEqual({ count: 0 })
  })

  it('loads saved data when hydrated', async () => {
    const { registry, store } = setup()
    const backend = createMemoryBackend({
      test: { version: 2, data: { count: 5 } },
    })
    const report = await registry.hydrate(backend)
    expect(store.get()).toEqual({ count: 5 })
    expect(report.loaded).toEqual(['test'])
  })

  it('writes changes through to the backend with a version envelope', async () => {
    const { registry, store } = setup()
    const backend = createMemoryBackend()
    await registry.hydrate(backend)
    store.set((previous) => ({ count: previous.count + 1 }))
    store.set((previous) => ({ count: previous.count + 1 }))
    await registry.flush()
    expect(backend.entries.get('test')).toEqual({
      version: 2,
      data: { count: 2 },
    })
  })

  it('migrates data from localStorage on first run, keeping the old copy', async () => {
    const { registry, store } = setup()
    const backend = createMemoryBackend()
    const old = legacy({
      test: JSON.stringify({ version: 1, data: { total: 9 } }),
    })
    const report = await registry.hydrate(backend, old)
    expect(store.get()).toEqual({ count: 9 })
    expect(report.migrated).toEqual(['test'])
    expect(backend.entries.get('test')).toEqual({
      version: 2,
      data: { count: 9 },
    })
    expect(backend.meta.get('migration:localStorage')).toMatchObject({
      keys: ['test'],
    })
    expect(old.getItem('test')).not.toBeNull()
  })

  it('prefers IndexedDB over a stale localStorage copy', async () => {
    const { registry, store } = setup()
    const backend = createMemoryBackend({
      test: { version: 2, data: { count: 3 } },
    })
    await registry.hydrate(
      backend,
      legacy({ test: JSON.stringify({ version: 2, data: { count: 1 } }) }),
    )
    expect(store.get()).toEqual({ count: 3 })
  })

  it('keeps a copy of unreadable data instead of overwriting it', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { registry, store } = setup()
    const backend = createMemoryBackend({
      test: { version: 2, data: 'garbage' },
    })
    const report = await registry.hydrate(backend)
    expect(store.get()).toEqual({ count: 0 })
    expect(report.unreadable).toEqual(['test'])
    expect(backend.entries.get('test.unreadable')).toEqual({
      version: 2,
      data: 'garbage',
    })
  })

  it('keeps changes made before hydration finished', async () => {
    const { registry, store } = setup()
    store.set({ count: 7 })
    const backend = createMemoryBackend({
      test: { version: 2, data: { count: 1 } },
    })
    await registry.hydrate(backend)
    expect(store.get()).toEqual({ count: 7 })
    expect(backend.entries.get('test')).toEqual({
      version: 2,
      data: { count: 7 },
    })
  })

  it('removes the saved value on reset', async () => {
    const { registry, store } = setup()
    const backend = createMemoryBackend({
      test: { version: 2, data: { count: 4 } },
    })
    await registry.hydrate(backend)
    store.reset()
    await registry.flush()
    expect(store.get()).toEqual({ count: 0 })
    expect(backend.entries.has('test')).toBe(false)
  })

  it('notifies subscribers', async () => {
    const { store } = setup()
    const listener = vi.fn()
    const unsubscribe = store.subscribe(listener)
    store.set({ count: 3 })
    unsubscribe()
    store.set({ count: 4 })
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('decodes backup envelopes, rejecting newer versions', () => {
    const { store } = setup()
    expect(store.decode({ version: 1, data: { total: 2 } })).toEqual({
      count: 2,
    })
    expect(store.decode({ version: 3, data: { count: 2 } })).toBeNull()
    expect(store.decode('nope')).toBeNull()
  })

  it('restores backups by replacing, or merging when the store says how', async () => {
    const replace = setup()
    replace.store.set({ count: 5 })
    await replace.registry.restore('test', { version: 2, data: { count: 2 } })
    expect(replace.store.get()).toEqual({ count: 2 })

    const merging = setup({
      merge: (a, b) => ({ count: Math.max(a.count, b.count) }),
    })
    merging.store.set({ count: 5 })
    await merging.registry.restore('test', { version: 2, data: { count: 2 } })
    expect(merging.store.get()).toEqual({ count: 5 })
  })

  it('loads stores registered after hydration (lazily loaded pages)', async () => {
    const registry = new StoreRegistry()
    await registry.hydrate(
      createMemoryBackend({ late: { version: 1, data: { count: 7 } } }),
    )
    const late = createPersistentStore<Counter>({
      key: 'late',
      version: 1,
      defaultValue: { count: 0 },
      parse,
      registry,
    })
    await registry.settled()
    expect(late.get()).toEqual({ count: 7 })
  })

  it('backs up and restores data for stores that are not loaded yet', async () => {
    const { registry, store } = setup()
    const backend = createMemoryBackend({
      later: { version: 1, data: { notes: 3 } },
    })
    await registry.hydrate(backend)
    store.set({ count: 4 })

    const snapshot = await registry.snapshotAll()
    expect(snapshot).toEqual({
      test: { version: 2, data: { count: 4 } },
      later: { version: 1, data: { notes: 3 } },
    })

    expect(
      await registry.restore('future', { version: 1, data: { tasks: [] } }),
    ).toBe(true)
    expect(backend.entries.get('future')).toEqual({
      version: 1,
      data: { tasks: [] },
    })
    // Data from a newer version of a store this version knows is left alone.
    expect(await registry.restore('test', { version: 9, data: {} })).toBe(false)
    expect(store.get()).toEqual({ count: 4 })
  })

  it('refuses two stores with the same key', () => {
    const { registry } = setup()
    expect(() =>
      createPersistentStore({
        key: 'test',
        version: 1,
        defaultValue: 0,
        parse: () => 0,
        registry,
      }),
    ).toThrow(/share the key/)
  })
})
