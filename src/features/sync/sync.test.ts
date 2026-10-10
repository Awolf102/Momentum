import type { Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import type { DatabaseSync } from 'node:sqlite'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  CollectionRegistry,
  createCollection,
  createMemoryCollectionBackend,
  type CollectionRecord,
} from '@/lib/collection'
import { createPersistentStore, StoreRegistry } from '@/lib/persistentStore'
import { createAccount } from '../../../server/auth.ts'
import { openDatabase } from '../../../server/db.ts'
import { createSyncServer } from '../../../server/http.ts'
import { DEFAULT_LIMITS } from '../../../server/sync.ts'
import { createClient, normalizeServer, SyncHttpError } from './lib/client'
import {
  deriveKeys,
  fingerprint,
  importRecordKey,
  open,
  seal,
  UnreadableRecordError,
} from './lib/crypto'
import {
  EMPTY_PROGRESS,
  syncOnce,
  type SyncProgress,
  type SyncSources,
} from './lib/engine'

// Fewer PBKDF2 rounds in tests; the derivation is the same.
const FAST = 1000

interface Note extends CollectionRecord {
  text: string
}
const parseNote = (value: unknown) => {
  const note = value as Note
  return typeof note?.id === 'string' && typeof note.text === 'string'
    ? note
    : null
}
const at = (minute: number) =>
  new Date(Date.UTC(2026, 9, 10, 10, minute)).toISOString()
const note = (
  id: string,
  text: string,
  minute: number,
  extra: Partial<Note> = {},
): Note => ({
  id,
  text,
  createdAt: at(0),
  updatedAt: at(minute),
  deletedAt: null,
  ...extra,
})

/** A device: its own collections and settings, in memory. */
async function device() {
  const collections = new CollectionRegistry()
  const notes = createCollection<Note>({
    name: 'notes',
    parse: parseNote,
    registry: collections,
  })
  await collections.hydrate(createMemoryCollectionBackend())
  const stores = new StoreRegistry()
  const streak = createPersistentStore<{ days: string[] }>({
    key: 'momentum.streak',
    version: 1,
    defaultValue: { days: [] },
    parse: (data) => {
      const days = (data as { days?: unknown })?.days
      return Array.isArray(days)
        ? { days: days.filter((day) => typeof day === 'string') }
        : null
    },
    merge: (current, incoming) => ({
      days: [...new Set([...current.days, ...incoming.days])].sort(),
    }),
    registry: stores,
  })
  const sources: SyncSources = {
    collections: ['notes'],
    exportCollections: (names) => collections.exportAll(names),
    importCollection: (name, records) =>
      collections.importRecords(name, records),
    stores: ['momentum.streak'],
    snapshotStores: () => stores.snapshotAll(),
    restoreStore: (key, envelope) => stores.restore(key, envelope),
  }
  let progress: SyncProgress = EMPTY_PROGRESS
  return {
    notes,
    streak,
    sources,
    get progress() {
      return progress
    },
    async sync(session: Parameters<typeof syncOnce>[1], now?: () => Date) {
      const result = await syncOnce(sources, session, progress, {
        now,
        limits: { batch: 3, recordChars: DEFAULT_LIMITS.recordChars },
      })
      progress = result.progress
      return result.report
    },
  }
}

let db: DatabaseSync
let server: Server
let base: string
beforeEach(async () => {
  db = openDatabase(':memory:')
  server = createSyncServer({
    db,
    signup: 'open',
    origins: ['*'],
    limits: { ...DEFAULT_LIMITS, batch: 3 },
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
})
afterEach(async () => {
  await new Promise((resolve) => server.close(resolve))
  db.close()
})

async function signIn(password = 'correct horse battery') {
  const keys = await deriveKeys('Sam', password, FAST)
  const client = createClient(base)
  let token: string
  try {
    token = (
      await client.signIn({
        username: 'sam',
        secret: keys.secret,
        device: 'test',
      })
    ).token
  } catch {
    token = (
      await client.createAccount({
        username: 'sam',
        secret: keys.secret,
        device: 'test',
      })
    ).token
  }
  return { client, token, key: await importRecordKey(keys.key) }
}

describe('keys', () => {
  it('come from the username and password, the same on every device', async () => {
    const one = await deriveKeys(' Sam ', 'pässword', FAST)
    const two = await deriveKeys('sam', 'pässword', FAST) // the same, typed decomposed
    expect(two).toEqual(one)
    expect(one.secret).toMatch(/^[A-Za-z0-9_-]{43}$/)
    expect(one.secret).not.toBe(one.key)
    expect(await deriveKeys('alex', 'pässword', FAST)).not.toEqual(one)
    expect(await deriveKeys('sam', 'other', FAST)).not.toEqual(one)
  })

  it('seal a record to its label, so it can’t be swapped or changed', async () => {
    const key = await importRecordKey((await deriveKeys('sam', 'pw', FAST)).key)
    const label = { store: 'notes', id: 'n1', updatedAt: at(1), deleted: false }
    const blob = await seal(key, label, { text: 'Karnaugh maps' })
    expect(atob(blob)).not.toContain('Karnaugh')
    expect(await open(key, label, blob)).toEqual({ text: 'Karnaugh maps' })
    await expect(open(key, { ...label, id: 'n2' }, blob)).rejects.toThrow(
      UnreadableRecordError,
    )
    await expect(
      open(key, { ...label, updatedAt: at(9) }, blob),
    ).rejects.toThrow(UnreadableRecordError)
    const other = await importRecordKey(
      (await deriveKeys('sam', 'other', FAST)).key,
    )
    await expect(open(other, label, blob)).rejects.toThrow(
      UnreadableRecordError,
    )
  })

  it('give each value a short fingerprint', async () => {
    expect(await fingerprint({ a: 1 })).toBe(await fingerprint({ a: 1 }))
    expect(await fingerprint({ a: 1 })).not.toBe(await fingerprint({ a: 2 }))
  })
})

describe('the server address', () => {
  it('is read as typed', () => {
    expect(normalizeServer('sync.example.com/')).toBe(
      'https://sync.example.com',
    )
    expect(normalizeServer(' http://localhost:8787 ')).toBe(
      'http://localhost:8787',
    )
    expect(normalizeServer('https://example.com/momentum/')).toBe(
      'https://example.com/momentum',
    )
    expect(normalizeServer('ftp://example.com')).toBe('')
    expect(normalizeServer('')).toBe('')
  })
})

describe('syncing two devices', () => {
  it('brings one device’s notes and settings to another, sealed on the way', async () => {
    const laptop = await device()
    await laptop.notes.put(note('n1', 'Karnaugh maps', 1))
    await laptop.notes.put(note('n2', 'Lab report', 2))
    laptop.streak.set({ days: ['2026-10-08', '2026-10-09'] })
    const session = await signIn()
    expect(await laptop.sync(session)).toMatchObject({
      pulled: 0,
      pushed: 3,
      rejected: 0,
    })

    // The server holds only sealed blobs.
    const blobs = db
      .prepare('SELECT blob FROM records')
      .all()
      .map((row) => atob(String(row.blob)))
    expect(blobs.join('')).not.toMatch(/Karnaugh|Lab report|2026-10-08/)

    const phone = await device()
    phone.streak.set({ days: ['2026-10-10'] })
    const report = await phone.sync(await signIn())
    expect(report.pulled).toBe(3)
    expect(phone.notes.get().map((each) => each.text)).toEqual([
      'Karnaugh maps',
      'Lab report',
    ])
    // Settings merge, as a restored backup does, and the merge goes back up.
    expect(phone.streak.get().days).toEqual([
      '2026-10-08',
      '2026-10-09',
      '2026-10-10',
    ])
    expect(report.pushed).toBe(1)
    await laptop.sync(session)
    expect(laptop.streak.get().days).toEqual([
      '2026-10-08',
      '2026-10-09',
      '2026-10-10',
    ])
    // Then they agree, and nothing more goes either way.
    expect(await laptop.sync(session)).toMatchObject({ pulled: 0, pushed: 0 })
    expect(await phone.sync(await signIn())).toMatchObject({
      pulled: 0,
      pushed: 0,
    })
  })

  it('carries edits and deletions back, and the later edit wins', async () => {
    const laptop = await device()
    const phone = await device()
    await laptop.notes.put(note('n1', 'Karnaugh maps', 1))
    await laptop.notes.put(note('n2', 'Lab report', 2))
    const session = await signIn()
    await laptop.sync(session)
    await phone.sync(session)

    await phone.notes.put(note('n1', 'Karnaugh maps, grouped', 5))
    await phone.notes.put(note('n2', 'Lab report', 6, { deletedAt: at(6) }))
    // Meanwhile, offline, the laptop edits n1 later still.
    await laptop.notes.put(note('n1', 'Karnaugh maps (laptop)', 7))
    await phone.sync(session)
    await laptop.sync(session)
    await phone.sync(session)
    for (const each of [laptop, phone]) {
      expect(each.notes.get().map((item) => item.text)).toEqual([
        'Karnaugh maps (laptop)',
      ])
      expect(each.notes.find('n2')?.deletedAt).toBe(at(6))
    }
  })

  it('sends records from before signing in, or from a restored backup, even when they’re old', async () => {
    const laptop = await device()
    await laptop.notes.put(note('n1', 'Recent', 30))
    const session = await signIn()
    await laptop.sync(session)
    // A backup restored here brings an older note the server never had.
    await laptop.sources.importCollection('notes', [
      note('old', 'From a backup', 1),
    ])
    expect(await laptop.sync(session)).toMatchObject({ pushed: 1 })
    const phone = await device()
    await phone.sync(session)
    expect(phone.notes.find('old')?.text).toBe('From a backup')
  })

  it('pulls a page at a time', async () => {
    const laptop = await device()
    for (let index = 0; index < 7; index++)
      await laptop.notes.put(note(`n${index}`, `Note ${index}`, index))
    const session = await signIn()
    await laptop.sync(session)
    const phone = await device()
    const report = await phone.sync(session)
    // Seven notes and the laptop's settings, three at a time.
    expect(report.pulled).toBe(8)
    expect(phone.notes.get()).toHaveLength(7)
    expect(phone.progress.seq).toBe(8)
  })

  it('leaves out a record too large, and says so', async () => {
    const laptop = await device()
    await laptop.notes.put(note('big', 'x'.repeat(2 * 1024 * 1024), 1))
    await laptop.notes.put(note('small', 'Fine', 2))
    const report = await laptop.sync(await signIn())
    expect(report.tooLarge).toEqual(['notes/big'])
    // The small note, and the settings (a device's first sync sends them).
    expect(report.pushed).toBe(2)
  })

  it('reports changes the server turns back for a clock far ahead, and tries them again', async () => {
    const laptop = await device()
    await laptop.notes.put(
      note('n1', 'From the future', 1, {
        updatedAt: '2099-01-01T00:00:00.000Z',
      }),
    )
    const session = await signIn()
    // Only the settings go; the note is turned back.
    expect(await laptop.sync(session)).toMatchObject({
      pushed: 1,
      rejected: 1,
    })
    expect(await laptop.sync(session)).toMatchObject({ rejected: 1 })
  })

  it('can’t read what another password sealed', async () => {
    const laptop = await device()
    await laptop.notes.put(note('n1', 'Secret', 1))
    const session = await signIn()
    await laptop.sync(session)
    const thief = await device()
    const wrongKey = await importRecordKey(
      (await deriveKeys('sam', 'guess', FAST)).key,
    )
    await expect(thief.sync({ ...session, key: wrongKey })).rejects.toThrow(
      UnreadableRecordError,
    )
    expect(thief.notes.get()).toEqual([])
  })

  it('tells a wrong password and an ended session apart', async () => {
    createAccount(db, { username: 'alex', secret: 'a'.repeat(43) }, 'open')
    const client = createClient(base)
    await expect(
      client.signIn({ username: 'alex', secret: 'b'.repeat(43), device: '' }),
    ).rejects.toMatchObject({
      status: 401,
      code: 'credentials',
    })
    await expect(client.pull('nonsense', 0)).rejects.toMatchObject({
      code: 'session',
    })
    const offline = createClient('http://127.0.0.1:9')
    await expect(offline.health()).rejects.toBeInstanceOf(SyncHttpError)
    await expect(offline.health()).rejects.toMatchObject({ code: 'offline' })
  })
})
