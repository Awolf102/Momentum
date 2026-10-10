import type { DatabaseSync } from 'node:sqlite'
import { transaction } from './db.ts'

/**
 * Pushing and pulling an account's records. A record is newer when its
 * `updatedAt` is later: the later edit wins, as when a backup is restored.
 * Each accepted change gets the account's next number (`seq`), so a device
 * asks for everything after the last number it saw.
 */

export interface SyncRecord {
  /** Which kind of record: a collection's name, or "kv" for settings. */
  store: string
  id: string
  /** ISO time of the change, from the device that made it. */
  updatedAt: string
  deleted: boolean
  /** The record, encrypted on the device (base64). */
  blob: string
}

export interface Limits {
  /** The most records in one push or pull. */
  batch: number
  /** The largest record, encrypted, in characters. */
  recordChars: number
  /** All of an account's records, in characters. */
  quotaChars: number
  /** How far ahead of the server's clock a change may be. */
  aheadMs: number
}

export const DEFAULT_LIMITS: Limits = {
  batch: 500,
  recordChars: 2 * 1024 * 1024,
  quotaChars: 200 * 1024 * 1024,
  aheadMs: 24 * 60 * 60 * 1000,
}

export class SyncError extends Error {
  readonly code: string
  constructor(code: string, message: string) {
    super(message)
    this.code = code
  }
}

const STORE = /^[A-Za-z][A-Za-z0-9_.-]{0,63}$/
const BASE64 = /^[A-Za-z0-9+/_=-]*$/

export type Rejection = { store: string; id: string; reason: 'clock' }

/** Reads a pushed record, or throws if it isn't one. */
function readRecord(value: unknown, limits: Limits): SyncRecord {
  const record = value as Partial<SyncRecord> | null
  if (
    !record ||
    typeof record.store !== 'string' ||
    !STORE.test(record.store) ||
    typeof record.id !== 'string' ||
    record.id.length < 1 ||
    record.id.length > 200 ||
    typeof record.updatedAt !== 'string' ||
    !Number.isFinite(Date.parse(record.updatedAt)) ||
    typeof record.deleted !== 'boolean' ||
    typeof record.blob !== 'string' ||
    !BASE64.test(record.blob)
  )
    throw new SyncError('record', 'A record is not in the right form.')
  if (record.blob.length > limits.recordChars)
    throw new SyncError('size', 'A record is too large.')
  return {
    store: record.store,
    id: record.id,
    updatedAt: new Date(record.updatedAt).toISOString(),
    deleted: record.deleted,
    blob: record.blob,
  }
}

/**
 * Keeps each pushed record that's newer than the account's copy. A change
 * from too far in the future (a device clock set wrong) is turned back,
 * since it would otherwise win over every later edit.
 */
export function push(
  db: DatabaseSync,
  userId: number,
  values: unknown,
  limits: Limits = DEFAULT_LIMITS,
  now = new Date(),
): { accepted: number; rejected: Rejection[]; seq: number } {
  if (!Array.isArray(values))
    throw new SyncError('record', 'Records come as a list.')
  if (values.length > limits.batch)
    throw new SyncError('batch', `At most ${limits.batch} records at a time.`)
  const records = values.map((value) => readRecord(value, limits))
  const latest = new Date(now.getTime() + limits.aheadMs).toISOString()
  return transaction(db, () => {
    const user = db
      .prepare('SELECT seq, bytes FROM users WHERE id = ?')
      .get(userId)
    if (!user) throw new SyncError('account', 'There’s no such account.')
    let seq = Number(user.seq)
    let bytes = Number(user.bytes)
    let accepted = 0
    const rejected: Rejection[] = []
    const find = db.prepare(
      'SELECT updated_at, length(blob) AS size FROM records WHERE user_id = ? AND store = ? AND id = ?',
    )
    const save = db.prepare(
      'INSERT OR REPLACE INTO records (user_id, store, id, updated_at, deleted, seq, blob) VALUES (?, ?, ?, ?, ?, ?, ?)',
    )
    for (const record of records) {
      if (record.updatedAt > latest) {
        rejected.push({ store: record.store, id: record.id, reason: 'clock' })
        continue
      }
      const existing = find.get(userId, record.store, record.id)
      if (existing && String(existing.updated_at) >= record.updatedAt) continue
      seq++
      bytes += record.blob.length - Number(existing?.size ?? 0)
      save.run(
        userId,
        record.store,
        record.id,
        record.updatedAt,
        record.deleted ? 1 : 0,
        seq,
        record.blob,
      )
      accepted++
    }
    if (bytes > limits.quotaChars)
      throw new SyncError('quota', 'This account is full.')
    db.prepare('UPDATE users SET seq = ?, bytes = ? WHERE id = ?').run(
      seq,
      bytes,
      userId,
    )
    return { accepted, rejected, seq }
  })
}

/** The account's records changed after `since`, oldest change first. */
export function pull(
  db: DatabaseSync,
  userId: number,
  since: number,
  limit: number,
  limits: Limits = DEFAULT_LIMITS,
): {
  records: Array<SyncRecord & { seq: number }>
  seq: number
  more: boolean
} {
  const count = Math.max(
    1,
    Math.min(limits.batch, Math.floor(limit) || limits.batch),
  )
  const from = Number.isFinite(since) && since > 0 ? Math.floor(since) : 0
  const rows = db
    .prepare(
      'SELECT store, id, updated_at, deleted, seq, blob FROM records WHERE user_id = ? AND seq > ? ORDER BY seq LIMIT ?',
    )
    .all(userId, from, count + 1)
  const user = db.prepare('SELECT seq FROM users WHERE id = ?').get(userId)
  const records = rows.slice(0, count).map((row) => ({
    store: String(row.store),
    id: String(row.id),
    updatedAt: String(row.updated_at),
    deleted: Number(row.deleted) === 1,
    seq: Number(row.seq),
    blob: String(row.blob),
  }))
  return {
    records,
    // Where the next pull starts: the last record here, or the latest.
    seq:
      rows.length > count
        ? records[records.length - 1].seq
        : Number(user?.seq ?? 0),
    more: rows.length > count,
  }
}

/** What an account keeps on the server, for the account page and the CLI. */
export function usage(db: DatabaseSync, userId: number) {
  const row = db
    .prepare(
      'SELECT count(*) AS records, coalesce(sum(length(blob)), 0) AS chars FROM records WHERE user_id = ?',
    )
    .get(userId)
  return { records: Number(row?.records ?? 0), chars: Number(row?.chars ?? 0) }
}
