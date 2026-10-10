// The settings stores that sync. Pulled settings combine by their stores'
// own rules, so they're registered here, whichever pages have been opened.
import '@/features/flashcards/settings'
import '@/features/focus/store'
import '@/features/habits/store'
import '@/features/review/store'
import '@/features/routines/store'
import '@/features/streak/store'
import '@/features/subjects/store'
import { collectionRegistry } from '@/lib/collection'
import { getDb } from '@/lib/db/db'
import { COLLECTION_STORES } from '@/lib/db/schema'
import { storeRegistry } from '@/lib/persistentStore'
import { deleteSecret, getSecret, setSecret } from '@/lib/secrets'
import { createStore } from '@/lib/store'
import { createClient, normalizeServer, SyncHttpError } from './lib/client'
import {
  deriveKeys,
  importRecordKey,
  normalizeUsername,
  UnreadableRecordError,
} from './lib/crypto'
import {
  EMPTY_PROGRESS,
  syncOnce,
  type SyncProgress,
  type SyncReport,
  type SyncSources,
} from './lib/engine'

/**
 * Sync on this device: signing in to a server, keeping the session, and
 * syncing when something changes, when the app comes back into view, and
 * every few minutes. The account and progress are this device's own (in
 * IndexedDB's `meta`, never backed up or synced); the session token and the
 * record key are secrets (never backed up either).
 */

/**
 * Settings that sync: ones about your data. Appearance, sound, reminders, AI
 * setup and the timer stay on each device.
 */
export const SYNCED_STORES = [
  'momentum.streak',
  'momentum.habits',
  'momentum.routines',
  'momentum.subjects',
  'momentum.focus',
  'momentum.cards',
  'momentum.review',
] as const

const TOKEN = 'sync:token'
const KEY = 'sync:key'
const ACCOUNT = 'sync:account'
const PROGRESS = 'sync:progress'
/** The protocol this app speaks (see `server/http.ts`). */
const PROTOCOL = 1

export interface SyncAccount {
  server: string
  username: string
  limits?: { batch: number; recordChars: number }
}

export type SyncStatus =
  | { state: 'off' }
  | {
      state: 'on'
      account: SyncAccount
      syncing: boolean
      lastSyncedAt: string | null
      report: SyncReport | null
      /** What went wrong last time, if it did. */
      problem: { code: string; message: string } | null
    }

export const syncStatusStore = createStore<SyncStatus>({ state: 'off' })

const sources: SyncSources = {
  collections: COLLECTION_STORES,
  exportCollections: (names) => collectionRegistry.exportAll(names),
  importCollection: (name, records) =>
    collectionRegistry.importRecords(name, records),
  stores: SYNCED_STORES,
  // Settings still at their defaults stay here, so a new device's don't
  // override the ones chosen on others.
  async snapshotStores() {
    const all = await storeRegistry.snapshotAll({ savedOnly: true })
    return Object.fromEntries(
      SYNCED_STORES.flatMap((key) => (all[key] ? [[key, all[key]]] : [])),
    )
  },
  restoreStore: (key, envelope, mode) =>
    storeRegistry.restore(key, envelope, mode),
}

async function readMeta<T>(key: string): Promise<T | undefined> {
  return (await (await getDb()).get('meta', key)) as T | undefined
}
async function writeMeta(key: string, value: unknown): Promise<void> {
  await (await getDb()).put('meta', value, key)
}

export const loadAccount = () => readMeta<SyncAccount>(ACCOUNT)

/** "Firefox on macOS", so the server's list of sessions means something. */
function deviceName(): string {
  if (typeof navigator === 'undefined') return ''
  const agent = navigator.userAgent
  const browser = /Edg\//.test(agent)
    ? 'Edge'
    : /Firefox\//.test(agent)
      ? 'Firefox'
      : /Chrome\//.test(agent)
        ? 'Chrome'
        : /Safari\//.test(agent)
          ? 'Safari'
          : 'A browser'
  const system = /iPhone|iPad/.test(agent)
    ? 'iOS'
    : /Android/.test(agent)
      ? 'Android'
      : /Mac OS X/.test(agent)
        ? 'macOS'
        : /Windows/.test(agent)
          ? 'Windows'
          : /Linux/.test(agent)
            ? 'Linux'
            : ''
  return system ? `${browser} on ${system}` : browser
}

/** Words for what went wrong, for Settings → Sync. */
export function describeProblem(error: unknown): {
  code: string
  message: string
} {
  if (error instanceof UnreadableRecordError)
    return {
      code: 'key',
      message:
        'Synced data couldn’t be opened with this device’s key: was the account made again with another password? Sign out, and sign in with the password used now.',
    }
  if (error instanceof SyncHttpError) {
    const messages: Record<string, string> = {
      offline:
        'Couldn’t reach the sync server. It will try again when you’re back online.',
      session: 'This device was signed out (the session ended). Sign in again.',
      credentials: 'The username or password is wrong.',
      invite: 'That invite code isn’t valid, or it was used already.',
      taken: 'That username is taken on this server.',
      username:
        'Usernames are 3 to 32 letters, digits, dots, dashes or underscores.',
      quota:
        'Your space on the sync server is full. Ask whoever runs it for more.',
      'slow-down': 'Too many tries. Wait a few minutes, then try again.',
    }
    return { code: error.code, message: messages[error.code] ?? error.message }
  }
  return {
    code: 'unknown',
    message: 'Something went wrong while syncing. It will try again shortly.',
  }
}

function setOn(
  account: SyncAccount,
  change: Partial<Extract<SyncStatus, { state: 'on' }>> = {},
) {
  const current = syncStatusStore.get()
  syncStatusStore.set({
    state: 'on',
    account,
    syncing: false,
    lastSyncedAt: null,
    report: null,
    problem: null,
    ...(current.state === 'on' ? current : {}),
    ...change,
  })
}

/**
 * Signs in to (or makes) an account, keeps the session and the record key
 * on this device, then syncs. The password is used here and forgotten.
 */
export async function connect(input: {
  server: string
  username: string
  password: string
  mode: 'sign-in' | 'create'
  invite?: string
}): Promise<void> {
  const server = normalizeServer(input.server)
  if (!server)
    throw new SyncHttpError(0, 'address', 'That isn’t a server address.')
  const client = createClient(server)
  const health = await client.health()
  if (health.version !== PROTOCOL)
    throw new SyncHttpError(
      0,
      'version',
      'This server speaks a different version of sync; update the server or the app.',
    )
  const username = normalizeUsername(input.username)
  const keys = await deriveKeys(username, input.password)
  const session =
    input.mode === 'create'
      ? await client.createAccount({
          username,
          secret: keys.secret,
          invite: input.invite?.trim() || undefined,
          device: deviceName(),
        })
      : await client.signIn({
          username,
          secret: keys.secret,
          device: deviceName(),
        })
  const account: SyncAccount = {
    server,
    username: session.username,
    limits: health.limits,
  }
  await setSecret(TOKEN, session.token)
  await setSecret(KEY, keys.key)
  await writeMeta(ACCOUNT, account)
  await writeMeta(PROGRESS, EMPTY_PROGRESS)
  syncStatusStore.set({
    state: 'on',
    account,
    syncing: false,
    lastSyncedAt: null,
    report: null,
    problem: null,
  })
  startSync()
  await syncNow()
}

/** Signs this device out. Everything stays here; the server keeps its copy. */
export async function disconnect(): Promise<void> {
  const account = await loadAccount()
  const token = await getSecret(TOKEN)
  if (account && token)
    await createClient(account.server)
      .signOut(token)
      .catch(() => {})
  await forget()
}

async function forget() {
  epoch += 1
  stopSync()
  await deleteSecret(TOKEN)
  await deleteSecret(KEY)
  const db = await getDb()
  await db.delete('meta', ACCOUNT)
  await db.delete('meta', PROGRESS)
  syncStatusStore.set({ state: 'off' })
}

/** Deletes the account and everything synced to it from the server. */
export async function deleteServerAccount(password: string): Promise<void> {
  const account = await loadAccount()
  const token = await getSecret(TOKEN)
  if (!account || !token) return
  const keys = await deriveKeys(account.username, password)
  await createClient(account.server).deleteAccount(token, keys.secret)
  await forget()
}

let running: Promise<void> | null = null
let again = false
/**
 * Moves on when this device signs out, so a round still running then
 * changes nothing.
 */
let epoch = 0

/** One round now (or right after the one in progress). */
export function syncNow(): Promise<void> {
  if (running) {
    again = true
    return running
  }
  running = (async () => {
    try {
      do {
        again = false
        await withLock(round)
      } while (again)
    } finally {
      running = null
    }
  })()
  return running
}

/** Tabs take turns, so two don't push the same changes at once. */
async function withLock(work: () => Promise<void>) {
  const locks = typeof navigator !== 'undefined' ? navigator.locks : undefined
  if (locks) await locks.request('momentum-sync', work)
  else await work()
}

async function round() {
  const current = epoch
  const signedIn = () => epoch === current
  const account = await loadAccount()
  const token = await getSecret(TOKEN)
  const keyText = await getSecret(KEY)
  if (!signedIn()) return
  if (!account || !token || !keyText) {
    syncStatusStore.set({ state: 'off' })
    return
  }
  setOn(account, { syncing: true })
  inRound = true
  missed = false
  let synced = false
  try {
    // Stores registered late load their saved data first.
    await storeRegistry.settled()
    const { report } = await syncOnce(
      sources,
      {
        client: createClient(account.server),
        token,
        key: await importRecordKey(keyText),
      },
      (await readMeta<SyncProgress>(PROGRESS)) ?? EMPTY_PROGRESS,
      {
        limits: account.limits,
        save: async (progress) => {
          if (signedIn()) await writeMeta(PROGRESS, progress)
        },
      },
    )
    synced = true
    if (signedIn())
      setOn(account, {
        syncing: false,
        lastSyncedAt: new Date().toISOString(),
        report,
        problem: null,
      })
  } catch (error) {
    if (signedIn())
      setOn(account, { syncing: false, problem: describeProblem(error) })
  } finally {
    inRound = false
    // Something changed here during the round: another goes straight after.
    // (A failed round leaves it for the next try.)
    if (missed && synced && started) again = true
  }
}

// What starts a round: local changes (after a pause), coming back into view
// or online, and a timer.
const AFTER_CHANGE_MS = 8_000
const EVERY_MS = 5 * 60_000
let inRound = false
let missed = false
let started = false
let changeTimer: ReturnType<typeof setTimeout> | null = null
let interval: ReturnType<typeof setInterval> | null = null
const unsubscribers: Array<() => void> = []

function soon(delay: number) {
  if (changeTimer) clearTimeout(changeTimer)
  changeTimer = setTimeout(() => {
    changeTimer = null
    void syncNow()
  }, delay)
}

const onChange = () => {
  // During a round, a change made here can't be told from one that was
  // pulled: the round after finds out (and sends nothing for the latter).
  if (inRound) missed = true
  else soon(AFTER_CHANGE_MS)
}
const onVisible = () => {
  if (document.visibilityState === 'visible') soon(500)
}
const onOnline = () => soon(500)

/** Starts syncing in the background, if this device is signed in. */
export function startSync(): void {
  if (started) return
  started = true
  unsubscribers.push(
    collectionRegistry.onChange(onChange),
    storeRegistry.onChange((key) => {
      if ((SYNCED_STORES as readonly string[]).includes(key)) onChange()
    }),
  )
  if (typeof window !== 'undefined') {
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('online', onOnline)
    interval = setInterval(() => {
      if (document.visibilityState === 'visible') void syncNow()
    }, EVERY_MS)
  }
  void loadAccount().then((account) => {
    if (!account) return
    setOn(account)
    // Signing in syncs straight away by itself.
    if (!running) void syncNow()
  })
}

function stopSync() {
  started = false
  for (const unsubscribe of unsubscribers.splice(0)) unsubscribe()
  if (typeof document !== 'undefined')
    document.removeEventListener('visibilitychange', onVisible)
  if (typeof window !== 'undefined')
    window.removeEventListener('online', onOnline)
  if (interval) clearInterval(interval)
  if (changeTimer) clearTimeout(changeTimer)
  interval = changeTimer = null
}
