import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'
import { closeDb } from './db/db'
import { DB_NAME } from './db/schema'
import { indexedDbBackend, indexedDbCollectionBackend } from './storage'

afterEach(async () => {
  await closeDb()
  indexedDB.deleteDatabase(DB_NAME)
})

const session = (id: string, minutes = 25) => ({
  id,
  day: '2026-10-10',
  subjectId: 'calculus',
  minutes,
  createdAt: '2026-10-10T09:00:00.000Z',
  updatedAt: '2026-10-10T09:00:00.000Z',
})

describe('IndexedDB backends', () => {
  it('writes and removes store values', async () => {
    const backend = indexedDbBackend()
    await backend.write('momentum.focus', { version: 1, data: { a: 1 } })
    expect(await backend.readAll()).toEqual(
      new Map([['momentum.focus', { version: 1, data: { a: 1 } }]]),
    )
    await backend.remove('momentum.focus')
    expect((await backend.readAll()).size).toBe(0)
  })

  it('adds a session once, even when two tabs try', async () => {
    const backend = indexedDbCollectionBackend()
    const results = await Promise.all([
      backend.add('focusSessions', session('s1', 25)),
      backend.add('focusSessions', session('s1', 30)),
    ])
    expect(results.sort()).toEqual([false, true])
    expect(await backend.getAll('focusSessions')).toHaveLength(1)
  })

  it('puts, reads and clears records', async () => {
    const backend = indexedDbCollectionBackend()
    await backend.put('focusSessions', session('s1'))
    await backend.put('focusSessions', session('s1', 50))
    expect(await backend.get('focusSessions', 's1')).toMatchObject({
      minutes: 50,
    })
    await backend.clear('focusSessions')
    expect(await backend.getAll('focusSessions')).toEqual([])
  })
})
