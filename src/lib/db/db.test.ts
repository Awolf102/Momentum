import 'fake-indexeddb/auto'
import { openDB } from 'idb'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { closeDb, getDb, onDbEvent } from './db'
import { DB_NAME, DB_VERSION } from './schema'

afterEach(async () => {
  await closeDb()
  indexedDB.deleteDatabase(DB_NAME)
})

describe('database schema', () => {
  it('creates every object store on a fresh install', async () => {
    const db = await getDb()
    expect(db.version).toBe(DB_VERSION)
    expect([...db.objectStoreNames].sort()).toEqual([
      'focusSessions',
      'habitCheckIns',
      'inboxItems',
      'kv',
      'logEntries',
      'meta',
      'notes',
      'photos',
      'routineRuns',
      'secrets',
      'tasks',
    ])
  })

  it('upgrades a v2 database (Phase 1) without touching existing data', async () => {
    // What Phase 1 created: streak, settings and keys already saved.
    const old = await openDB(DB_NAME, 2, {
      upgrade(database) {
        database.createObjectStore('photos')
        database.createObjectStore('kv')
        database.createObjectStore('secrets')
        database.createObjectStore('meta')
      },
    })
    const streak = {
      version: 1,
      data: { checkIns: { '2026-10-09': { at: '2026-10-09T08:00:00.000Z' } } },
    }
    await old.put('kv', streak, 'momentum.streak')
    await old.put(
      'kv',
      { version: 1, data: { theme: 'light' } },
      'momentum.appearance',
    )
    await old.put('secrets', 'sk-ant-test-key', 'anthropic')
    await old.put('photos', 'photo-bytes', 'abc:full')
    old.close()

    const db = await getDb()
    expect(db.version).toBe(DB_VERSION)
    expect(await db.get('kv', 'momentum.streak')).toEqual(streak)
    expect(await db.get('kv', 'momentum.appearance')).toEqual({
      version: 1,
      data: { theme: 'light' },
    })
    expect(await db.get('secrets', 'anthropic')).toBe('sk-ant-test-key')
    expect(await db.get('photos', 'abc:full')).toBe('photo-bytes')
    // The new store is ready, indexed by day and by subject.
    const tx = db.transaction('focusSessions')
    expect([...tx.store.indexNames].sort()).toEqual(['by-day', 'by-subject'])
    await db.put('focusSessions', {
      id: 's1',
      day: '2026-10-10',
      subjectId: 'calculus',
    })
    expect(
      await db.getAllFromIndex('focusSessions', 'by-day', '2026-10-10'),
    ).toHaveLength(1)
  })

  it('upgrades a v3 database (focus timer) without touching its sessions', async () => {
    const old = await openDB(DB_NAME, 3, {
      upgrade(database) {
        for (const name of ['photos', 'kv', 'secrets', 'meta'])
          database.createObjectStore(name)
        const sessions = database.createObjectStore('focusSessions', {
          keyPath: 'id',
        })
        sessions.createIndex('by-day', 'day')
        sessions.createIndex('by-subject', 'subjectId')
      },
    })
    await old.put('focusSessions', {
      id: 's1',
      day: '2026-10-10',
      subjectId: 'calculus',
    })
    old.close()

    const db = await getDb()
    expect(db.version).toBe(DB_VERSION)
    expect(await db.get('focusSessions', 's1')).toMatchObject({
      day: '2026-10-10',
    })
    await db.put('logEntries', {
      id: '2026-10-10',
      day: '2026-10-10',
      text: 'Lab done',
    })
    await db.put('tasks', {
      id: 't1',
      due: '2026-10-12',
      status: 'todo',
      subjectId: null,
    })
    expect(
      await db.getAllFromIndex('tasks', 'by-due', '2026-10-12'),
    ).toHaveLength(1)
    expect(await db.get('logEntries', '2026-10-10')).toMatchObject({
      text: 'Lab done',
    })
  })

  it('upgrades the v1 photo database without losing photos', async () => {
    // What earlier versions created (via idb-keyval): one "photos" store.
    const old = await openDB(DB_NAME, 1, {
      upgrade(database) {
        database.createObjectStore('photos')
      },
    })
    await old.put('photos', 'photo-bytes', 'abc:full')
    old.close()

    const db = await getDb()
    expect(db.version).toBe(DB_VERSION)
    expect(await db.get('photos', 'abc:full')).toBe('photo-bytes')
    expect(db.objectStoreNames.contains('kv')).toBe(true)
  })

  it('waits for an older tab to let go before upgrading, and says so', async () => {
    // An older version of the app, still open in another tab, that doesn't
    // close its connection when asked (as idb-keyval in v2 didn't).
    const old = await openDB(DB_NAME, 1, {
      upgrade(database) {
        database.createObjectStore('photos')
      },
    })
    const events: string[] = []
    const stop = onDbEvent((event) => events.push(event))
    const opening = getDb()
    await vi.waitFor(() => expect(events).toEqual(['blocked']))
    old.close()
    expect((await opening).version).toBe(DB_VERSION)
    stop()
  })

  it('steps aside when a newer version in another tab upgrades', async () => {
    const events: string[] = []
    const stop = onDbEvent((event) => events.push(event))
    await getDb()
    const newer = await openDB(DB_NAME, DB_VERSION + 1)
    expect(newer.version).toBe(DB_VERSION + 1)
    expect(events).toEqual(['outdated'])
    newer.close()
    stop()
  })
})
