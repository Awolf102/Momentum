import { describe, expect, it, vi } from 'vitest'
import { createMemoryStorage, createPersistentStore } from './persistentStore'

interface Counter {
  count: number
}

const parse = (data: unknown): Counter | null =>
  typeof data === 'object' &&
  data !== null &&
  typeof (data as Counter).count === 'number'
    ? { count: (data as Counter).count }
    : null

function setup(initial?: string) {
  const storage = createMemoryStorage()
  if (initial !== undefined) storage.setItem('test', initial)
  const store = createPersistentStore<Counter>({
    key: 'test',
    version: 2,
    defaultValue: { count: 0 },
    parse,
    migrate: (data, fromVersion) =>
      fromVersion === 1 ? { count: (data as { total: number }).total } : null,
    storage,
  })
  return { storage, store }
}

describe('createPersistentStore', () => {
  it('starts from the default value', () => {
    expect(setup().store.get()).toEqual({ count: 0 })
  })

  it('persists updates with a version envelope', () => {
    const { storage, store } = setup()
    store.set((previous) => ({ count: previous.count + 1 }))
    expect(store.get()).toEqual({ count: 1 })
    expect(JSON.parse(storage.getItem('test')!)).toEqual({
      version: 2,
      data: { count: 1 },
    })
  })

  it('loads previously saved data', () => {
    const { store } = setup(JSON.stringify({ version: 2, data: { count: 5 } }))
    expect(store.get()).toEqual({ count: 5 })
  })

  it('migrates data from older versions', () => {
    const { store } = setup(JSON.stringify({ version: 1, data: { total: 9 } }))
    expect(store.get()).toEqual({ count: 9 })
  })

  it('keeps a copy of unreadable data instead of overwriting it', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { storage, store } = setup('{not json')
    expect(store.get()).toEqual({ count: 0 })
    expect(storage.getItem('test.unreadable')).toBe('{not json')
  })

  it('notifies subscribers and supports reset', () => {
    const { storage, store } = setup()
    const listener = vi.fn()
    const unsubscribe = store.subscribe(listener)
    store.set({ count: 3 })
    store.reset()
    expect(listener).toHaveBeenCalledTimes(2)
    expect(store.get()).toEqual({ count: 0 })
    expect(storage.getItem('test')).toBeNull()
    unsubscribe()
    store.set({ count: 4 })
    expect(listener).toHaveBeenCalledTimes(2)
  })

  it('decodes backup envelopes, rejecting newer versions', () => {
    const { store } = setup()
    expect(store.decode({ version: 1, data: { total: 2 } })).toEqual({
      count: 2,
    })
    expect(store.decode({ version: 3, data: { count: 2 } })).toBeNull()
    expect(store.decode('nope')).toBeNull()
  })
})
