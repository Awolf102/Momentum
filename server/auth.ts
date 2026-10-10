import {
  createHash,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from 'node:crypto'
import type { DatabaseSync } from 'node:sqlite'
import { transaction } from './db.ts'

/**
 * Accounts and sessions. The app never sends the password: it sends a
 * secret derived from it (and keeps the key that encrypts records, derived
 * alongside). The server keeps only an scrypt hash of that secret, and only
 * hashes of session tokens and invite codes.
 */

export class AuthError extends Error {
  readonly code: string
  constructor(code: string, message: string) {
    super(message)
    this.code = code
  }
}

/** Lower case letters, digits, dots, dashes and underscores; 3 to 32. */
export const USERNAME = /^[a-z0-9._-]{3,32}$/
export const normalizeUsername = (value: string) => value.trim().toLowerCase()

/** The secret is 32 bytes, base64url: 43 characters. */
const SECRET = /^[A-Za-z0-9_-]{43}$/
const SESSION_DAYS = 90
const SCRYPT = { N: 1 << 14, r: 8, p: 1 } as const

const now = () => new Date()
const sha256 = (value: string) =>
  createHash('sha256').update(value).digest('base64url')
const token = () => randomBytes(32).toString('base64url')

export function hashSecret(secret: string): string {
  const salt = randomBytes(16)
  const hash = scryptSync(secret, salt, 32, SCRYPT)
  return `scrypt$${SCRYPT.N}$${SCRYPT.r}$${SCRYPT.p}$${salt.toString('base64url')}$${hash.toString('base64url')}`
}

export function verifySecret(secret: string, stored: string): boolean {
  const [kind, n, r, p, salt, hash] = stored.split('$')
  if (kind !== 'scrypt' || !salt || !hash) return false
  const expected = Buffer.from(hash, 'base64url')
  const actual = scryptSync(
    secret,
    Buffer.from(salt, 'base64url'),
    expected.length,
    {
      N: Number(n),
      r: Number(r),
      p: Number(p),
    },
  )
  return timingSafeEqual(actual, expected)
}

export type Signup = 'invite' | 'open'

/** Makes a one-time invite code (shown once; only its hash is kept). */
export function createInvite(db: DatabaseSync): string {
  const code = randomBytes(9).toString('base64url')
  db.prepare('INSERT INTO invites (code_hash, created_at) VALUES (?, ?)').run(
    sha256(code),
    now().toISOString(),
  )
  return code
}

function checkSecret(secret: unknown): asserts secret is string {
  if (typeof secret !== 'string' || !SECRET.test(secret))
    throw new AuthError(
      'invalid',
      'The sign-in secret is not in the right form.',
    )
}

/** A new account; with invites, the code is used up. Returns its id. */
export function createAccount(
  db: DatabaseSync,
  input: { username?: unknown; secret?: unknown; invite?: unknown },
  signup: Signup,
): number {
  const username =
    typeof input.username === 'string' ? normalizeUsername(input.username) : ''
  if (!USERNAME.test(username))
    throw new AuthError(
      'username',
      'Usernames are 3 to 32 letters, digits, dots, dashes or underscores.',
    )
  checkSecret(input.secret)
  const secret = input.secret
  return transaction(db, () => {
    if (signup === 'invite') {
      const code = typeof input.invite === 'string' ? input.invite.trim() : ''
      const used = db
        .prepare(
          'UPDATE invites SET used_at = ? WHERE code_hash = ? AND used_at IS NULL',
        )
        .run(now().toISOString(), sha256(code))
      if (!code || used.changes !== 1)
        throw new AuthError(
          'invite',
          'That invite code isn’t valid, or was used.',
        )
    }
    const taken = db
      .prepare('SELECT 1 FROM users WHERE username = ?')
      .get(username)
    if (taken) throw new AuthError('taken', 'That username is taken.')
    const result = db
      .prepare(
        'INSERT INTO users (username, secret_hash, created_at) VALUES (?, ?, ?)',
      )
      .run(username, hashSecret(secret), now().toISOString())
    return Number(result.lastInsertRowid)
  })
}

/** The account's id, if the secret is right. */
export function checkAccount(
  db: DatabaseSync,
  input: { username?: unknown; secret?: unknown },
): number {
  const username =
    typeof input.username === 'string' ? normalizeUsername(input.username) : ''
  checkSecret(input.secret)
  const row = db
    .prepare('SELECT id, secret_hash FROM users WHERE username = ?')
    .get(username)
  // Hash anyway when there's no such account, so timing doesn't tell.
  const stored =
    typeof row?.secret_hash === 'string' ? row.secret_hash : DUMMY_HASH
  const right = verifySecret(input.secret, stored)
  if (!row || !right)
    throw new AuthError('credentials', 'The username or password is wrong.')
  return Number(row.id)
}
const DUMMY_HASH = hashSecret('x'.repeat(43))

export function createSession(
  db: DatabaseSync,
  userId: number,
  device = '',
): string {
  const value = token()
  const created = now()
  const expires = new Date(created.getTime() + SESSION_DAYS * 86_400_000)
  db.prepare(
    'INSERT INTO sessions (token_hash, user_id, device, created_at, last_used_at, expires_at) VALUES (?, ?, ?, ?, ?, ?)',
  ).run(
    sha256(value),
    userId,
    device.slice(0, 80),
    created.toISOString(),
    created.toISOString(),
    expires.toISOString(),
  )
  return value
}

/** The account a session token belongs to, or null (and an old one is let go). */
export function findSession(db: DatabaseSync, value: string): number | null {
  if (!value) return null
  const hash = sha256(value)
  const row = db
    .prepare('SELECT user_id, expires_at FROM sessions WHERE token_hash = ?')
    .get(hash)
  if (!row) return null
  const at = now()
  if (String(row.expires_at) <= at.toISOString()) {
    db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(hash)
    return null
  }
  // In use: it lasts another 90 days from now.
  db.prepare(
    'UPDATE sessions SET last_used_at = ?, expires_at = ? WHERE token_hash = ?',
  ).run(
    at.toISOString(),
    new Date(at.getTime() + SESSION_DAYS * 86_400_000).toISOString(),
    hash,
  )
  return Number(row.user_id)
}

export function deleteSession(db: DatabaseSync, value: string): void {
  db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(sha256(value))
}

/** The account, its sessions and every record it synced. */
export function deleteAccount(db: DatabaseSync, userId: number): void {
  db.prepare('DELETE FROM users WHERE id = ?').run(userId)
}

/**
 * At most `limit` tries per key in `windowMs` (sign-ins per username and
 * per address), kept in memory.
 */
export class Attempts {
  private readonly hits = new Map<string, number[]>()
  private readonly limit: number
  private readonly windowMs: number
  constructor(limit: number, windowMs: number) {
    this.limit = limit
    this.windowMs = windowMs
  }

  /** Counts a try; false once there have been too many. */
  allow(key: string, at = Date.now()): boolean {
    const recent = (this.hits.get(key) ?? []).filter(
      (time) => at - time < this.windowMs,
    )
    if (recent.length >= this.limit) {
      this.hits.set(key, recent)
      return false
    }
    recent.push(at)
    this.hits.set(key, recent)
    if (this.hits.size > 10_000) this.prune(at)
    return true
  }

  private prune(at: number) {
    for (const [key, times] of this.hits)
      if (times.every((time) => at - time >= this.windowMs))
        this.hits.delete(key)
  }
}
