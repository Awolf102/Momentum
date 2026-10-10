import type { CollectionRecord } from '@/lib/collection'
import type { RestoreMode, StoredEnvelope } from '@/lib/persistentStore'
import type { SyncClient, WireRecord } from './client'
import { fingerprint, open, seal, type RecordLabel } from './crypto'

/**
 * One round of sync: pull what other devices changed, apply it (the later
 * edit wins, as when a backup is restored), then push what changed here.
 * A record goes up when it's newer than the version this device knows the
 * server has, so data from before signing in, or from a restored backup,
 * goes up too. Everything is sealed before it leaves.
 *
 * Settings travel whole, so devices have to settle on one version: pulled
 * settings replace this device's when it hasn't changed them since it last
 * synced. When it has, the two are combined by the store's own rule, this
 * device's side winning where they disagree (the account's side, on a
 * device's first sync), and the result goes back up for the others to take.
 */

/** Where the engine reads and writes this device's data. */
export interface SyncSources {
  /** The collections that sync. */
  collections: readonly string[]
  exportCollections(
    names: readonly string[],
  ): Promise<Record<string, CollectionRecord[]>>
  importCollection(name: string, records: unknown[]): Promise<number>
  /** The settings stores that sync (merged on arrival, as backups are). */
  stores: readonly string[]
  snapshotStores(): Promise<Record<string, StoredEnvelope>>
  restoreStore(
    key: string,
    envelope: unknown,
    mode: RestoreMode,
  ): Promise<boolean>
}

export interface SyncSession {
  client: SyncClient
  token: string
  key: CryptoKey
}

/**
 * What this device knows: the last change number it pulled, and, per store,
 * the version of each record the server has (a time for records, a
 * fingerprint for settings).
 */
export interface SyncProgress {
  seq: number
  known: Record<string, Record<string, string>>
}

export const EMPTY_PROGRESS: SyncProgress = { seq: 0, known: {} }

/** Settings stores travel as records of this store, by key. */
export const SETTINGS_STORE = 'kv'
/** The server's default limits: records per push, and the largest record. */
export const DEFAULT_BATCH = 200
export const DEFAULT_RECORD_CHARS = 2 * 1024 * 1024

export interface SyncReport {
  pulled: number
  pushed: number
  /** Changes the server turned back (this device's clock is far ahead). */
  rejected: number
  /** Records too large to sync, as "store/id". */
  tooLarge: string[]
}

interface Outgoing {
  label: RecordLabel
  value: unknown
  /** What `known` records once it's up. */
  version: string
}

export async function syncOnce(
  sources: SyncSources,
  session: SyncSession,
  start: SyncProgress,
  options: {
    now?: () => Date
    /** Called as progress is made, so an interruption loses little. */
    save?: (progress: SyncProgress) => Promise<void>
    /** The server's limits (from its health check). */
    limits?: { batch: number; recordChars: number }
  } = {},
): Promise<{ report: SyncReport; progress: SyncProgress }> {
  const now = options.now ?? (() => new Date())
  const save = options.save ?? (async () => {})
  const batchSize = Math.max(1, options.limits?.batch ?? DEFAULT_BATCH)
  // A little room under the server's limit for the JSON around the blob.
  const maxBlob = (options.limits?.recordChars ?? DEFAULT_RECORD_CHARS) - 4096
  const progress: SyncProgress = structuredClone(start)
  const knownIn = (store: string) => (progress.known[store] ??= {})
  const report: SyncReport = { pulled: 0, pushed: 0, rejected: 0, tooLarge: [] }

  // Pull, a page at a time.
  for (;;) {
    const page = await session.client.pull(session.token, progress.seq)
    const records = new Map<string, unknown[]>()
    const settings: Array<[string, unknown]> = []
    for (const record of page.records) {
      const label: RecordLabel = {
        store: record.store,
        id: record.id,
        updatedAt: record.updatedAt,
        deleted: record.deleted,
      }
      if (record.store === SETTINGS_STORE) {
        if (!sources.stores.includes(record.id)) continue
        settings.push([record.id, await open(session.key, label, record.blob)])
      } else if (sources.collections.includes(record.store)) {
        const list = records.get(record.store) ?? []
        list.push(await open(session.key, label, record.blob))
        records.set(record.store, list)
        knownIn(record.store)[record.id] = record.updatedAt
      }
      // Stores this version doesn't have (from a newer app) wait for it.
    }
    for (const [name, list] of records)
      await sources.importCollection(name, list)
    const here = settings.length ? await sources.snapshotStores() : {}
    for (const [key, envelope] of settings) {
      const known = progress.known[SETTINGS_STORE]?.[key]
      const mine = here[key] ? await fingerprint(here[key]) : undefined
      await sources.restoreStore(
        key,
        envelope,
        known === undefined
          ? 'merge-theirs'
          : mine === known
            ? 'replace'
            : 'merge',
      )
      knownIn(SETTINGS_STORE)[key] = await fingerprint(envelope)
    }
    report.pulled += page.records.length
    progress.seq = page.seq
    await save(progress)
    if (!page.more) break
  }

  // Push what's newer here than what the server has.
  const outgoing: Outgoing[] = []
  const collections = await sources.exportCollections(sources.collections)
  for (const name of sources.collections) {
    const known = progress.known[name] ?? {}
    for (const record of collections[name] ?? []) {
      const version = known[record.id]
      if (version !== undefined && record.updatedAt <= version) continue
      outgoing.push({
        label: {
          store: name,
          id: record.id,
          updatedAt: record.updatedAt,
          deleted: Boolean(record.deletedAt),
        },
        value: record,
        version: record.updatedAt,
      })
    }
  }
  const envelopes = await sources.snapshotStores()
  const stamp = now().toISOString()
  for (const key of sources.stores) {
    const envelope = envelopes[key]
    if (!envelope) continue
    const print = await fingerprint(envelope)
    if (progress.known[SETTINGS_STORE]?.[key] === print) continue
    outgoing.push({
      label: {
        store: SETTINGS_STORE,
        id: key,
        updatedAt: stamp,
        deleted: false,
      },
      value: envelope,
      version: print,
    })
  }

  for (let index = 0; index < outgoing.length; index += batchSize) {
    const batch: Array<Outgoing & { wire: WireRecord }> = []
    for (const item of outgoing.slice(index, index + batchSize)) {
      const blob = await seal(session.key, item.label, item.value)
      if (blob.length > maxBlob) {
        report.tooLarge.push(`${item.label.store}/${item.label.id}`)
        continue
      }
      batch.push({ ...item, wire: { ...item.label, blob } })
    }
    if (!batch.length) continue
    const result = await session.client.push(
      session.token,
      batch.map((item) => item.wire),
    )
    const turnedBack = new Set(
      result.rejected.map((each) => `${each.store}/${each.id}`),
    )
    for (const item of batch) {
      if (turnedBack.has(`${item.label.store}/${item.label.id}`)) continue
      knownIn(item.label.store)[item.label.id] = item.version
    }
    report.pushed += result.accepted
    report.rejected += result.rejected.length
    // When nothing came in from elsewhere meanwhile, the changes just
    // numbered are this device's own: no need to pull them back.
    if (result.seq === progress.seq + result.accepted) progress.seq = result.seq
    await save(progress)
  }
  return { report, progress }
}
