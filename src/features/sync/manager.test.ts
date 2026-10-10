import 'fake-indexeddb/auto'
import type { Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import type { DatabaseSync } from 'node:sqlite'
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from 'vitest'
import {
  collectionRegistry,
  createCollection,
  createMemoryCollectionBackend,
  type CollectionRecord,
} from '@/lib/collection'
import { closeDb, getDb } from '@/lib/db/db'
import { DB_NAME } from '@/lib/db/schema'
import { createMemoryBackend, storeRegistry } from '@/lib/persistentStore'
import { openDatabase } from '../../../server/db.ts'
import { createSyncServer } from '../../../server/http.ts'
import {
  connect,
  disconnect,
  SYNCED_STORES,
  syncNow,
  syncStatusStore,
} from './manager'

// Sync on this device, against the real server: what starts a round, and
// what happens when something changes in the middle of one.

interface Item extends CollectionRecord {
  text: string
}
const inbox = createCollection<Item>({
  name: 'inboxItems',
  parse: (value) => {
    const item = value as Item
    return typeof item?.id === 'string' && typeof item.text === 'string'
      ? item
      : null
  },
  registry: collectionRegistry,
})
let tick = 0
const item = (id: string, text: string): Item => {
  const at = new Date(Date.now() - 60_000 + tick++ * 1000).toISOString()
  return { id, text, createdAt: at, updatedAt: at, deletedAt: null }
}

/** Each push, as the "store/id" of what it carried. */
let pushes: string[][] = []
let gate: {
  method: string
  reach: () => void
  released: Promise<void>
} | null = null

/**
 * Holds the next sync request of this kind once the server has answered it,
 * so the test can act while the round waits on it.
 */
function hold(method: 'GET' | 'POST') {
  let reach!: () => void
  let release!: () => void
  const reached = new Promise<void>((resolve) => (reach = resolve))
  const released = new Promise<void>((resolve) => (release = resolve))
  gate = { method, reach, released }
  return { reached, release }
}

const realFetch = globalThis.fetch
let db: DatabaseSync
let server: Server
let base: string

beforeAll(async () => {
  vi.stubGlobal('fetch', async (input: string, init: RequestInit = {}) => {
    const method = init.method ?? 'GET'
    const isSync = new URL(input).pathname === '/api/sync'
    if (isSync && method === 'POST') {
      const { records } = JSON.parse(String(init.body)) as {
        records: Array<{ store: string; id: string }>
      }
      pushes.push(records.map((record) => `${record.store}/${record.id}`))
    }
    const response = await realFetch(input, init)
    if (isSync && gate?.method === method) {
      const { reach, released } = gate
      gate = null
      reach()
      await released
    }
    return response
  })
  // No other tabs here.
  vi.stubGlobal('BroadcastChannel', undefined)
  await collectionRegistry.hydrate(createMemoryCollectionBackend())
  await storeRegistry.hydrate(createMemoryBackend())
  db = openDatabase(':memory:')
  server = createSyncServer({ db, signup: 'open', origins: ['*'] })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
})

afterEach(async () => {
  if (syncStatusStore.get().state === 'on') await disconnect()
  pushes = []
})

afterAll(async () => {
  await new Promise((resolve) => server.close(resolve))
  db.close()
  await closeDb()
  await new Promise((resolve) => {
    const request = indexedDB.deleteDatabase(DB_NAME)
    request.onsuccess = request.onerror = () => resolve(undefined)
  })
  vi.unstubAllGlobals()
})

const password = 'correct horse battery'

describe('sync on this device', () => {
  it('sends a change made during a round in another, straight after', async () => {
    await connect({ server: base, username: 'sam', password, mode: 'create' })
    await syncNow()
    expect(syncStatusStore.get()).toMatchObject({ state: 'on', problem: null })
    // Every synced store's code has loaded, for pulled settings to merge by.
    expect(storeRegistry.keys()).toEqual(
      expect.arrayContaining([...SYNCED_STORES]),
    )

    await inbox.put(item('i1', 'Buy a lab coat'))
    pushes = []
    const push = hold('POST')
    const round = syncNow()
    await push.reached
    // Added once the round had read what to send.
    await inbox.put(item('i2', 'Email the tutor'))
    push.release()
    await round
    expect(pushes).toEqual([['inboxItems/i1'], ['inboxItems/i2']])
  })

  it('stays signed out when signing out in the middle of a round', async () => {
    await connect({ server: base, username: 'alex', password, mode: 'create' })
    await syncNow()
    const pull = hold('GET')
    const round = syncNow()
    await pull.reached
    await disconnect()
    pull.release()
    await round
    expect(syncStatusStore.get()).toEqual({ state: 'off' })
    const meta = await getDb()
    expect(await meta.get('meta', 'sync:account')).toBeUndefined()
    expect(await meta.get('meta', 'sync:progress')).toBeUndefined()
  })
})
