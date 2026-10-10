import { mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { createInvite, deleteAccount, normalizeUsername } from './auth.ts'
import { openDatabase } from './db.ts'
import { createSyncServer } from './http.ts'
import { DEFAULT_LIMITS, usage } from './sync.ts'

/**
 * Momentum's sync server.
 *
 *   node server/main.ts serve          run it (see the settings below)
 *   node server/main.ts invite         make a one-time invite code
 *   node server/main.ts users          list the accounts and what they keep
 *   node server/main.ts remove-user N  delete an account and its records
 *
 * Settings, from the environment: PORT (8787), HOST (127.0.0.1; put it
 * behind HTTPS before opening it to the internet), MOMENTUM_SYNC_DB
 * (data/momentum-sync.db), MOMENTUM_SYNC_SIGNUP ("invite", or "open" for
 * anyone), MOMENTUM_SYNC_ORIGINS (where the app is served from, comma
 * separated; "*" for any), MOMENTUM_SYNC_QUOTA_MB (200 per account).
 */

const env = process.env
const dataPath = resolve(env.MOMENTUM_SYNC_DB ?? 'data/momentum-sync.db')
const [command = 'serve', ...rest] = process.argv.slice(2)

function open() {
  mkdirSync(dirname(dataPath), { recursive: true })
  return openDatabase(dataPath)
}

switch (command) {
  case 'serve': {
    const db = open()
    const port = Number(env.PORT ?? 8787)
    const host = env.HOST ?? '127.0.0.1'
    const signup = env.MOMENTUM_SYNC_SIGNUP === 'open' ? 'open' : 'invite'
    const origins = (env.MOMENTUM_SYNC_ORIGINS ?? '*')
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean)
    const quotaMb = Number(env.MOMENTUM_SYNC_QUOTA_MB ?? 200)
    const server = createSyncServer({
      db,
      signup,
      origins,
      limits: {
        ...DEFAULT_LIMITS,
        quotaChars:
          (Number.isFinite(quotaMb) && quotaMb > 0 ? quotaMb : 200) *
          1024 *
          1024,
      },
      log: (line) => console.log(line),
    })
    server.listen(port, host, () =>
      console.log(
        `Momentum sync is on http://${host}:${port} (sign-up: ${signup}; data: ${dataPath})`,
      ),
    )
    const stop = () =>
      server.close(() => {
        db.close()
        process.exit(0)
      })
    process.on('SIGINT', stop)
    process.on('SIGTERM', stop)
    break
  }
  case 'invite': {
    const db = open()
    console.log(createInvite(db))
    db.close()
    break
  }
  case 'users': {
    const db = open()
    const rows = db
      .prepare('SELECT id, username, created_at FROM users ORDER BY username')
      .all()
    if (!rows.length) console.log('No accounts yet.')
    for (const row of rows) {
      const { records, chars } = usage(db, Number(row.id))
      console.log(
        `${String(row.username)}  ${records} records, ${(chars / 1024 / 1024).toFixed(1)} MB, since ${String(row.created_at).slice(0, 10)}`,
      )
    }
    db.close()
    break
  }
  case 'remove-user': {
    const name = normalizeUsername(rest[0] ?? '')
    const db = open()
    const row = db.prepare('SELECT id FROM users WHERE username = ?').get(name)
    if (!row) {
      console.error(`There's no account called "${name}".`)
      process.exitCode = 1
    } else {
      deleteAccount(db, Number(row.id))
      console.log(`Deleted "${name}" and everything it synced.`)
    }
    db.close()
    break
  }
  default:
    console.error(
      'Use: node server/main.ts serve | invite | users | remove-user <name>',
    )
    process.exitCode = 1
}
