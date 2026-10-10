import { describe, expect, it } from 'vitest'
import {
  CollectionRegistry,
  createCollection,
  createMemoryCollectionBackend,
  type CollectionRecord,
} from './collection'

interface Note extends CollectionRecord {
  text: string
}

const parse = (value: unknown): Note | null =>
  typeof value === 'object' &&
  value !== null &&
  typeof (value as Note).text === 'string'
    ? (value as Note)
    : null

const note = (
  id: string,
  text: string,
  updatedAt = '2026-10-10T00:00:00.000Z',
): Note => ({
  id,
  text,
  createdAt: '2026-10-10T00:00:00.000Z',
  updatedAt,
})

function setup() {
  const registry = new CollectionRegistry()
  const backend = createMemoryCollectionBackend()
  const notes = createCollection<Note>({ name: 'notes', parse, registry })
  return { registry, backend, notes }
}

describe('collections', () => {
  it('loads saved records on hydration, skipping unreadable ones', async () => {
    const { registry, backend, notes } = setup()
    await backend.put('notes', note('a', 'first'))
    await backend.put('notes', {
      id: 'b',
      updatedAt: 'x',
      createdAt: 'x',
    } as CollectionRecord)
    await registry.hydrate(backend)
    expect(notes.get().map((n) => n.text)).toEqual(['first'])
  })

  it('adds a record once: a second add with the same id is refused', async () => {
    const { registry, backend, notes } = setup()
    await registry.hydrate(backend)
    expect(await notes.add(note('a', 'first'))).toBe(true)
    expect(await notes.add(note('a', 'again'))).toBe(false)
    expect(notes.get()).toHaveLength(1)
    expect(
      (backend.tables.get('notes')?.get('a') as Note | undefined)?.text,
    ).toBe('first')
  })

  it('takes the stored copy when another tab added the record first', async () => {
    const { registry, backend, notes } = setup()
    await registry.hydrate(backend)
    await backend.add('notes', note('a', 'from the other tab'))
    expect(await notes.add(note('a', 'from this tab'))).toBe(false)
    expect(notes.find('a')?.text).toBe('from the other tab')
  })

  it('soft-deletes, keeping the record for history', async () => {
    const { registry, backend, notes } = setup()
    await registry.hydrate(backend)
    await notes.add(note('a', 'first'))
    await notes.remove('a', new Date('2026-10-11T00:00:00Z'))
    expect(notes.get()).toEqual([])
    expect(backend.tables.get('notes')?.get('a')?.deletedAt).toBe(
      '2026-10-11T00:00:00.000Z',
    )
  })

  it('clears everything for a fresh start', async () => {
    const { registry, backend, notes } = setup()
    await registry.hydrate(backend)
    await notes.add(note('a', 'first'))
    await notes.clear()
    expect(notes.get()).toEqual([])
    expect(backend.tables.get('notes')?.size).toBe(0)
  })

  it('merges a backup: new records added, newer versions win, older ones ignored', async () => {
    const { registry, backend, notes } = setup()
    await registry.hydrate(backend)
    await notes.put(note('a', 'mine, newer', '2026-10-10T12:00:00.000Z'))
    const changed = await registry.importRecords('notes', [
      note('a', 'backup, older', '2026-10-10T08:00:00.000Z'),
      note('b', 'only in backup'),
      {
        ...note('c', 'deleted in backup'),
        deletedAt: '2026-10-10T09:00:00.000Z',
      },
      { nonsense: true },
    ])
    // The deletion is merged, but not counted as restored.
    expect(changed).toBe(1)
    expect(
      notes
        .get()
        .map((n) => n.text)
        .sort(),
    ).toEqual(['mine, newer', 'only in backup'])
  })

  it('exports every record, deleted ones included', async () => {
    const { registry, backend, notes } = setup()
    await registry.hydrate(backend)
    await notes.add(note('a', 'kept'))
    await notes.add(note('b', 'deleted'))
    await notes.remove('b')
    const exported = await registry.exportAll(['notes'])
    expect(exported.notes.map((n) => n.id).sort()).toEqual(['a', 'b'])
  })

  it('loads collections created after hydration (lazy pages)', async () => {
    const registry = new CollectionRegistry()
    const backend = createMemoryCollectionBackend()
    await backend.put('late', note('a', 'saved earlier'))
    await registry.hydrate(backend)
    const late = createCollection<Note>({ name: 'late', parse, registry })
    await registry.settled()
    expect(late.get().map((n) => n.text)).toEqual(['saved earlier'])
  })

  it('keeps working in memory without a backend', async () => {
    const registry = new CollectionRegistry()
    const notes = createCollection<Note>({ name: 'notes', parse, registry })
    await registry.hydrate(null)
    expect(await notes.add(note('a', 'first'))).toBe(true)
    expect(await notes.add(note('a', 'first'))).toBe(false)
    expect(notes.get()).toHaveLength(1)
  })
})
