/**
 * Sync's keys and sealing, with WebCrypto only. From the username and
 * password, on this device, come two things: a secret to sign in with (the
 * server keeps only a hash of it) and the key that encrypts every record
 * before it leaves (never sent). So the server can't read what's synced,
 * and without the password nobody can.
 */

/** OWASP's current advice for PBKDF2-HMAC-SHA256 (as for backups). */
export const ITERATIONS = 600_000

const encoder = new TextEncoder()
const decoder = new TextDecoder()

export const normalizeUsername = (value: string) => value.trim().toLowerCase()

function toBase64(bytes: Uint8Array): string {
  let binary = ''
  for (let index = 0; index < bytes.length; index += 0x8000)
    binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000))
  return btoa(binary)
}

function fromBase64(text: string): Uint8Array<ArrayBuffer> {
  const binary = atob(text)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index++)
    bytes[index] = binary.charCodeAt(index)
  return bytes
}

const base64url = (bytes: Uint8Array) =>
  toBase64(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

export interface DerivedKeys {
  /** Sent to sign in: 32 bytes, base64url. */
  secret: string
  /** Encrypts records: 32 bytes, base64; kept on this device only. */
  key: string
}

/** The sign-in secret and the record key, from the username and password. */
export async function deriveKeys(
  username: string,
  password: string,
  iterations = ITERATIONS,
): Promise<DerivedKeys> {
  const material = await crypto.subtle.importKey(
    'raw',
    // The same password typed on another device gives the same bytes.
    encoder.encode(password.normalize('NFC')),
    'PBKDF2',
    false,
    ['deriveBits'],
  )
  const master = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      hash: 'SHA-256',
      // The username makes each account's derivation its own.
      salt: encoder.encode(`momentum-sync:${normalizeUsername(username)}`),
      iterations,
    },
    material,
    256,
  )
  const expand = async (info: string) =>
    new Uint8Array(
      await crypto.subtle.deriveBits(
        {
          name: 'HKDF',
          hash: 'SHA-256',
          salt: new Uint8Array(0),
          info: encoder.encode(info),
        },
        await crypto.subtle.importKey('raw', master, 'HKDF', false, [
          'deriveBits',
        ]),
        256,
      ),
    )
  return {
    secret: base64url(await expand('momentum-sync sign-in')),
    key: toBase64(await expand('momentum-sync records')),
  }
}

export function importRecordKey(key: string): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', fromBase64(key), 'AES-GCM', false, [
    'encrypt',
    'decrypt',
  ])
}

/** What the server sees of a record; sealed with it, so it can't be swapped. */
export interface RecordLabel {
  store: string
  id: string
  updatedAt: string
  deleted: boolean
}

const additional = (label: RecordLabel) =>
  encoder.encode(
    JSON.stringify([label.store, label.id, label.updatedAt, label.deleted]),
  )

/** Encrypts a record: base64 of a fresh IV followed by the AES-GCM output. */
export async function seal(
  key: CryptoKey,
  label: RecordLabel,
  value: unknown,
): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const sealed = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv, additionalData: additional(label) },
      key,
      encoder.encode(JSON.stringify(value)),
    ),
  )
  const joined = new Uint8Array(iv.length + sealed.length)
  joined.set(iv)
  joined.set(sealed, iv.length)
  return toBase64(joined)
}

/** Thrown when a record can't be opened: another key, or it was altered. */
export class UnreadableRecordError extends Error {
  constructor() {
    super('A synced record could not be read with this password.')
  }
}

export async function open(
  key: CryptoKey,
  label: RecordLabel,
  blob: string,
): Promise<unknown> {
  try {
    const bytes = fromBase64(blob)
    const plain = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: bytes.subarray(0, 12),
        additionalData: additional(label),
      },
      key,
      bytes.subarray(12),
    )
    return JSON.parse(decoder.decode(plain))
  } catch {
    throw new UnreadableRecordError()
  }
}

/** A short fingerprint of a value, to tell whether it changed. */
export async function fingerprint(value: unknown): Promise<string> {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    encoder.encode(JSON.stringify(value)),
  )
  return base64url(new Uint8Array(digest)).slice(0, 22)
}
