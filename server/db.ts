import { DatabaseSync } from 'node:sqlite'

/**
 * The sync server's SQLite database: accounts, sessions, invite codes, and
 * each account's records, which arrive encrypted (the server only sees which
 * store a record is in, its id, when it changed and whether it's deleted).
 */

export const SCHEMA_VERSION = 1

/** Each step brings the schema from the version before to its own. */
const STEPS: ReadonlyArray<string> = [
  `CREATE TABLE users (
     id INTEGER PRIMARY KEY,
     username TEXT NOT NULL UNIQUE,
     -- scrypt of the secret the app derives from the password
     secret_hash TEXT NOT NULL,
     -- the account's latest change number: records carry the one they got
     seq INTEGER NOT NULL DEFAULT 0,
     bytes INTEGER NOT NULL DEFAULT 0,
     created_at TEXT NOT NULL
   );
   CREATE TABLE sessions (
     token_hash TEXT PRIMARY KEY,
     user_id INTEGER NOT NULL REFERENCES users (id) ON DELETE CASCADE,
     device TEXT NOT NULL DEFAULT '',
     created_at TEXT NOT NULL,
     last_used_at TEXT NOT NULL,
     expires_at TEXT NOT NULL
   );
   CREATE TABLE invites (
     code_hash TEXT PRIMARY KEY,
     created_at TEXT NOT NULL,
     used_at TEXT
   );
   CREATE TABLE records (
     user_id INTEGER NOT NULL REFERENCES users (id) ON DELETE CASCADE,
     store TEXT NOT NULL,
     id TEXT NOT NULL,
     updated_at TEXT NOT NULL,
     deleted INTEGER NOT NULL,
     seq INTEGER NOT NULL,
     -- base64 of the IV and the AES-GCM ciphertext, made on the device
     blob TEXT NOT NULL,
     PRIMARY KEY (user_id, store, id)
   );
   CREATE INDEX records_by_seq ON records (user_id, seq);`,
]

export function openDatabase(path: string): DatabaseSync {
  const db = new DatabaseSync(path)
  if (path !== ':memory:') db.exec('PRAGMA journal_mode = WAL')
  db.exec('PRAGMA foreign_keys = ON')
  migrate(db)
  return db
}

function migrate(db: DatabaseSync) {
  db.exec(
    'CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)',
  )
  const row = db.prepare("SELECT value FROM meta WHERE key = 'schema'").get()
  let version = row ? Number(row.value) : 0
  if (version > STEPS.length)
    throw new Error(
      `This database is from a newer server (schema ${version}); update the server.`,
    )
  while (version < STEPS.length) {
    transaction(db, () => {
      db.exec(STEPS[version])
      db.prepare(
        "INSERT OR REPLACE INTO meta (key, value) VALUES ('schema', ?)",
      ).run(String(version + 1))
    })
    version++
  }
}

/** Runs `work` in a transaction: all of it, or none of it. */
export function transaction<T>(db: DatabaseSync, work: () => T): T {
  db.exec('BEGIN IMMEDIATE')
  try {
    const result = work()
    db.exec('COMMIT')
    return result
  } catch (error) {
    db.exec('ROLLBACK')
    throw error
  }
}
