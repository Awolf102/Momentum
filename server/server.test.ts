import type { AddressInfo } from 'node:net'
import type { Server } from 'node:http'
import type { DatabaseSync } from 'node:sqlite'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  Attempts,
  checkAccount,
  createAccount,
  createInvite,
  createSession,
  deleteAccount,
  deleteSession,
  findSession,
  hashSecret,
  verifySecret,
} from './auth.ts'
import { openDatabase } from './db.ts'
import { createSyncServer } from './http.ts'
import { DEFAULT_LIMITS, pull, push, type SyncRecord } from './sync.ts'

const SECRET = 'a'.repeat(43)
const OTHER = 'b'.repeat(43)
const record = (
  id: string,
  updatedAt: string,
  extra: Partial<SyncRecord> = {},
): SyncRecord => ({
  store: 'notes',
  id,
  updatedAt,
  deleted: false,
  blob: Buffer.from(`${id}@${updatedAt}`).toString('base64'),
  ...extra,
})

let db: DatabaseSync
beforeEach(() => {
  db = openDatabase(':memory:')
})
afterEach(() => db.close())

describe('the database', () => {
  it('is made at the latest schema, and opening it again changes nothing', () => {
    expect(
      db.prepare("SELECT value FROM meta WHERE key = 'schema'").get()?.value,
    ).toBe('1')
    const tables = db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name",
      )
      .all()
      .map((row) => row.name)
    expect(tables).toEqual(['invites', 'meta', 'records', 'sessions', 'users'])
  })
})

describe('accounts', () => {
  it('keeps only a hash of the secret, and checks it', () => {
    const hash = hashSecret(SECRET)
    expect(hash).not.toContain(SECRET)
    expect(verifySecret(SECRET, hash)).toBe(true)
    expect(verifySecret(OTHER, hash)).toBe(false)
    expect(verifySecret(SECRET, 'nonsense')).toBe(false)
  })

  it('needs an invite, used once', () => {
    expect(() =>
      createAccount(db, { username: 'sam', secret: SECRET }, 'invite'),
    ).toThrow(expect.objectContaining({ code: 'invite' }))
    const code = createInvite(db)
    const id = createAccount(
      db,
      { username: ' Sam ', secret: SECRET, invite: code },
      'invite',
    )
    expect(id).toBeGreaterThan(0)
    expect(() =>
      createAccount(
        db,
        { username: 'alex', secret: SECRET, invite: code },
        'invite',
      ),
    ).toThrow(expect.objectContaining({ code: 'invite' }))
  })

  it('with open sign-up, needs only a free, sensible name and a secret', () => {
    createAccount(db, { username: 'sam', secret: SECRET }, 'open')
    expect(() =>
      createAccount(db, { username: 'SAM', secret: SECRET }, 'open'),
    ).toThrow(expect.objectContaining({ code: 'taken' }))
    for (const username of ['x', 'with space', 'émile', 'a'.repeat(33), 42])
      expect(() =>
        createAccount(db, { username, secret: SECRET }, 'open'),
      ).toThrow(expect.objectContaining({ code: 'username' }))
    expect(() =>
      createAccount(db, { username: 'alex', secret: 'short' }, 'open'),
    ).toThrow(expect.objectContaining({ code: 'invalid' }))
  })

  it('signs in with the right secret only, whatever the case of the name', () => {
    const id = createAccount(db, { username: 'sam', secret: SECRET }, 'open')
    expect(checkAccount(db, { username: 'Sam', secret: SECRET })).toBe(id)
    expect(() => checkAccount(db, { username: 'sam', secret: OTHER })).toThrow(
      expect.objectContaining({ code: 'credentials' }),
    )
    expect(() =>
      checkAccount(db, { username: 'nobody', secret: SECRET }),
    ).toThrow(expect.objectContaining({ code: 'credentials' }))
  })

  it('has sessions that end on sign-out, and go with the account', () => {
    const id = createAccount(db, { username: 'sam', secret: SECRET }, 'open')
    const token = createSession(db, id, 'Firefox')
    expect(findSession(db, token)).toBe(id)
    expect(findSession(db, 'not-a-token')).toBeNull()
    expect(findSession(db, '')).toBeNull()
    deleteSession(db, token)
    expect(findSession(db, token)).toBeNull()
    const again = createSession(db, id)
    push(db, id, [record('n1', '2026-10-10T10:00:00.000Z')])
    deleteAccount(db, id)
    expect(findSession(db, again)).toBeNull()
    expect(db.prepare('SELECT count(*) AS n FROM records').get()?.n).toBe(0)
  })

  it('lets an old session go', () => {
    const id = createAccount(db, { username: 'sam', secret: SECRET }, 'open')
    const token = createSession(db, id)
    db.prepare('UPDATE sessions SET expires_at = ?').run(
      '2000-01-01T00:00:00.000Z',
    )
    expect(findSession(db, token)).toBeNull()
    expect(db.prepare('SELECT count(*) AS n FROM sessions').get()?.n).toBe(0)
  })

  it('limits tries in a window', () => {
    const attempts = new Attempts(3, 1000)
    expect([1, 2, 3, 4].map(() => attempts.allow('sam', 0))).toEqual([
      true,
      true,
      true,
      false,
    ])
    expect(attempts.allow('alex', 0)).toBe(true)
    expect(attempts.allow('sam', 1001)).toBe(true)
  })
})

describe('sync', () => {
  let sam: number
  let alex: number
  beforeEach(() => {
    sam = createAccount(db, { username: 'sam', secret: SECRET }, 'open')
    alex = createAccount(db, { username: 'alex', secret: SECRET }, 'open')
  })

  it('keeps what one device pushes for another to pull, in order', () => {
    const result = push(db, sam, [
      record('n1', '2026-10-10T10:00:00.000Z'),
      record('n2', '2026-10-10T10:01:00.000Z', { deleted: true }),
    ])
    expect(result).toEqual({ accepted: 2, rejected: [], seq: 2 })
    const pulled = pull(db, sam, 0, 100)
    expect(pulled.more).toBe(false)
    expect(pulled.seq).toBe(2)
    expect(
      pulled.records.map((each) => [each.id, each.seq, each.deleted]),
    ).toEqual([
      ['n1', 1, false],
      ['n2', 2, true],
    ])
    expect(pull(db, sam, 2, 100)).toEqual({ records: [], seq: 2, more: false })
  })

  it('keeps accounts apart', () => {
    push(db, sam, [record('n1', '2026-10-10T10:00:00.000Z')])
    expect(pull(db, alex, 0, 100).records).toEqual([])
    push(db, alex, [record('n1', '2026-10-10T09:00:00.000Z')])
    expect(pull(db, sam, 0, 100).records[0].updatedAt).toBe(
      '2026-10-10T10:00:00.000Z',
    )
  })

  it('lets the later edit win, whichever arrives first', () => {
    push(db, sam, [record('n1', '2026-10-10T10:00:00.000Z')])
    expect(
      push(db, sam, [record('n1', '2026-10-10T09:00:00.000Z')]).accepted,
    ).toBe(0)
    expect(
      push(db, sam, [record('n1', '2026-10-10T10:00:00.000Z')]).accepted,
    ).toBe(0)
    const later = push(db, sam, [
      record('n1', '2026-10-10T11:00:00.000Z', { deleted: true }),
    ])
    expect(later).toMatchObject({ accepted: 1, seq: 2 })
    const [kept] = pull(db, sam, 0, 100).records
    expect(kept).toMatchObject({
      updatedAt: '2026-10-10T11:00:00.000Z',
      deleted: true,
      seq: 2,
    })
  })

  it('pages through changes', () => {
    push(
      db,
      sam,
      Array.from({ length: 5 }, (_, index) =>
        record(`n${index}`, `2026-10-10T10:0${index}:00.000Z`),
      ),
    )
    const first = pull(db, sam, 0, 2)
    expect(first.records.map((each) => each.id)).toEqual(['n0', 'n1'])
    expect(first).toMatchObject({ seq: 2, more: true })
    const second = pull(db, sam, first.seq, 2)
    expect(second.records.map((each) => each.id)).toEqual(['n2', 'n3'])
    const last = pull(db, sam, second.seq, 2)
    expect(last).toMatchObject({ seq: 5, more: false })
    expect(last.records.map((each) => each.id)).toEqual(['n4'])
  })

  it('turns back a change from a clock far ahead, keeping the rest', () => {
    const now = new Date('2026-10-10T12:00:00.000Z')
    const result = push(
      db,
      sam,
      [
        record('ahead', '2026-10-12T12:00:00.000Z'),
        record('fine', '2026-10-11T11:00:00.000Z'),
      ],
      DEFAULT_LIMITS,
      now,
    )
    expect(result.accepted).toBe(1)
    expect(result.rejected).toEqual([
      { store: 'notes', id: 'ahead', reason: 'clock' },
    ])
  })

  it('refuses records that aren’t, too many, too large, or past the quota', () => {
    for (const bad of [
      [{ ...record('n1', '2026-10-10T10:00:00.000Z'), store: '1bad' }],
      [{ ...record('n1', 'yesterday') }],
      [{ ...record('n1', '2026-10-10T10:00:00.000Z'), blob: 'not base64!' }],
      [{ ...record('', '2026-10-10T10:00:00.000Z') }],
      'not a list',
    ])
      expect(() => push(db, sam, bad)).toThrow(
        expect.objectContaining({ code: 'record' }),
      )
    const small = {
      ...DEFAULT_LIMITS,
      batch: 2,
      recordChars: 40,
      quotaChars: 60,
    }
    expect(() =>
      push(
        db,
        sam,
        [1, 2, 3].map((n) => record(`n${n}`, '2026-10-10T10:00:00.000Z')),
        small,
      ),
    ).toThrow(expect.objectContaining({ code: 'batch' }))
    expect(() =>
      push(
        db,
        sam,
        [record('n1', '2026-10-10T10:00:00.000Z', { blob: 'A'.repeat(41) })],
        small,
      ),
    ).toThrow(expect.objectContaining({ code: 'size' }))
    push(
      db,
      sam,
      [record('n1', '2026-10-10T10:00:00.000Z', { blob: 'A'.repeat(40) })],
      small,
    )
    expect(() =>
      push(
        db,
        sam,
        [record('n2', '2026-10-10T10:00:00.000Z', { blob: 'A'.repeat(40) })],
        small,
      ),
    ).toThrow(expect.objectContaining({ code: 'quota' }))
    // A refused push leaves nothing behind.
    expect(pull(db, sam, 0, 100).records.map((each) => each.id)).toEqual(['n1'])
    // Replacing a record counts its new size, not both.
    push(
      db,
      sam,
      [record('n1', '2026-10-11T10:00:00.000Z', { blob: 'B'.repeat(40) })],
      small,
    )
  })
})

describe('over HTTP', () => {
  let server: Server
  let base: string
  let lines: string[]
  beforeEach(async () => {
    lines = []
    server = createSyncServer({
      db,
      signup: 'invite',
      origins: ['https://momentum.example'],
      maxBody: 4096,
      log: (line) => lines.push(line),
    })
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
  })
  afterEach(async () => {
    await new Promise((resolve) => server.close(resolve))
  })
  const call = (path: string, init: RequestInit = {}, token?: string) =>
    fetch(base + path, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        Origin: 'https://momentum.example',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...init.headers,
      },
    })
  const json = (body: unknown) => JSON.stringify(body)

  it('says what it is, and lets the app’s origin call it', async () => {
    const health = await call('/api/health')
    expect(await health.json()).toEqual({
      ok: true,
      version: 1,
      signup: 'invite',
      limits: { batch: 500, recordChars: 2 * 1024 * 1024 },
    })
    expect(health.headers.get('access-control-allow-origin')).toBe(
      'https://momentum.example',
    )
    expect(health.headers.get('cache-control')).toBe('no-store')
    const preflight = await call('/api/sync', { method: 'OPTIONS' })
    expect(preflight.status).toBe(204)
    expect(preflight.headers.get('access-control-allow-headers')).toContain(
      'Authorization',
    )
    const elsewhere = await fetch(base + '/api/health', {
      headers: { Origin: 'https://evil.example' },
    })
    expect(elsewhere.headers.get('access-control-allow-origin')).toBeNull()
  })

  it('makes an account with an invite, signs in and out, and syncs', async () => {
    const refused = await call('/api/accounts', {
      method: 'POST',
      body: json({ username: 'sam', secret: SECRET }),
    })
    expect(refused.status).toBe(403)
    const invite = createInvite(db)
    const made = await call('/api/accounts', {
      method: 'POST',
      body: json({ username: 'Sam', secret: SECRET, invite, device: 'Laptop' }),
    })
    expect(made.status).toBe(201)
    const { token, username } = (await made.json()) as {
      token: string
      username: string
    }
    expect(username).toBe('sam')

    expect((await call('/api/sync')).status).toBe(401)
    const pushed = await call(
      '/api/sync',
      {
        method: 'POST',
        body: json({ records: [record('n1', '2026-10-10T10:00:00.000Z')] }),
      },
      token,
    )
    expect(await pushed.json()).toEqual({ accepted: 1, rejected: [], seq: 1 })

    const wrong = await call('/api/sessions', {
      method: 'POST',
      body: json({ username: 'sam', secret: OTHER }),
    })
    expect(wrong.status).toBe(401)
    const phone = await call('/api/sessions', {
      method: 'POST',
      body: json({ username: 'sam', secret: SECRET }),
    })
    const { token: second } = (await phone.json()) as { token: string }
    const pulled = (await (
      await call('/api/sync?since=0', {}, second)
    ).json()) as {
      records: SyncRecord[]
      seq: number
    }
    expect(pulled.records.map((each) => each.id)).toEqual(['n1'])
    expect(pulled.seq).toBe(1)

    const account = await (await call('/api/account', {}, second)).json()
    expect(account).toMatchObject({ username: 'sam', seq: 1, records: 1 })

    expect(
      (await call('/api/sessions', { method: 'DELETE' }, second)).status,
    ).toBe(204)
    expect((await call('/api/sync', {}, second)).status).toBe(401)
    expect((await call('/api/sync', {}, token)).status).toBe(200)
  })

  it('needs the password again to delete the account', async () => {
    createAccount(db, { username: 'sam', secret: SECRET }, 'open')
    const signIn = await call('/api/sessions', {
      method: 'POST',
      body: json({ username: 'sam', secret: SECRET }),
    })
    const { token } = (await signIn.json()) as { token: string }
    const wrong = await call(
      '/api/account',
      { method: 'DELETE', body: json({ secret: OTHER }) },
      token,
    )
    expect(wrong.status).toBe(401)
    const right = await call(
      '/api/account',
      { method: 'DELETE', body: json({ secret: SECRET }) },
      token,
    )
    expect(right.status).toBe(204)
    expect((await call('/api/sync', {}, token)).status).toBe(401)
  })

  it('turns away bodies too large, and requests that aren’t JSON', async () => {
    createAccount(db, { username: 'sam', secret: SECRET }, 'open')
    const signIn = await call('/api/sessions', {
      method: 'POST',
      body: json({ username: 'sam', secret: SECRET }),
    })
    const { token } = (await signIn.json()) as { token: string }
    const big = await call(
      '/api/sync',
      {
        method: 'POST',
        body: json({
          records: [
            record('n1', '2026-10-10T10:00:00.000Z', {
              blob: 'A'.repeat(5000),
            }),
          ],
        }),
      },
      token,
    )
    expect(big.status).toBe(413)
    const notJson = await call(
      '/api/sync',
      { method: 'POST', body: 'hello' },
      token,
    )
    expect(notJson.status).toBe(400)
    expect(await notJson.json()).toMatchObject({ error: 'json' })
    expect((await call('/nowhere')).status).toBe(404)
  })

  it('slows down after many wrong passwords', async () => {
    createAccount(db, { username: 'sam', secret: SECRET }, 'open')
    const statuses: number[] = []
    for (let index = 0; index < 11; index++)
      statuses.push(
        (
          await call('/api/sessions', {
            method: 'POST',
            body: json({ username: 'sam', secret: OTHER }),
          })
        ).status,
      )
    expect(statuses.slice(0, 10).every((status) => status === 401)).toBe(true)
    expect(statuses[10]).toBe(429)
  })

  it('logs a line per request, without tokens, bodies or queries', async () => {
    createAccount(db, { username: 'sam', secret: SECRET }, 'open')
    const signIn = await call('/api/sessions', {
      method: 'POST',
      body: json({ username: 'sam', secret: SECRET }),
    })
    const { token } = (await signIn.json()) as { token: string }
    await call('/api/sync?since=0', {}, token)
    expect(lines).toHaveLength(2)
    expect(lines[1]).toMatch(/^GET \/api\/sync 200 \d+ ms$/)
    expect(lines.join('\n')).not.toContain(token)
    expect(lines.join('\n')).not.toContain(SECRET)
  })
})
