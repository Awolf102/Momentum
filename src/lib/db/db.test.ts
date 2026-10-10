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
      'kv',
      'meta',
      'photos',
      'secrets',
    ])
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
