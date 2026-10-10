import { isRecord } from '@/lib/guards'

/**
 * Password-protected backups: the ordinary backup, encrypted with AES-GCM
 * under a key derived from the password with PBKDF2 (SHA-256). Only the
 * WebCrypto API is used; the password and key never leave this function.
 */
export const ENCRYPTED_FORMAT = 'momentum-backup-encrypted'
const VERSION = 1
/** OWASP's current advice for PBKDF2-HMAC-SHA256. */
export const ITERATIONS = 600_000
/** Bounds for files read back, so a hostile file can't hang the page. */
const MIN_ITERATIONS = 100_000
const MAX_ITERATIONS = 10_000_000
export const MIN_PASSWORD_LENGTH = 8

export interface EncryptedBackup {
  format: typeof ENCRYPTED_FORMAT
  version: number
  /** When it was made (also in the file name; not secret). */
  exportedAt: string
  kdf: { name: 'PBKDF2'; hash: 'SHA-256'; iterations: number; salt: string }
  cipher: { name: 'AES-GCM'; iv: string }
  /** The encrypted backup, base64. */
  data: string
}

/** Thrown when a protected backup is opened without a password. */
export class PasswordNeededError extends Error {
  constructor() {
    super('This backup is protected with a password.')
  }
}

/** Thrown when the password doesn't open the backup (or it was altered). */
export class WrongPasswordError extends Error {
  constructor() {
    super("That password doesn't open this backup.")
  }
}

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

async function deriveKey(
  password: string,
  salt: Uint8Array<ArrayBuffer>,
  iterations: number,
): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey(
    'raw',
    // The same password typed on another device gives the same bytes.
    new TextEncoder().encode(password.normalize('NFC')),
    'PBKDF2',
    false,
    ['deriveKey'],
  )
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

export async function encryptBackup(
  plaintext: string,
  password: string,
  { exportedAt = new Date().toISOString(), iterations = ITERATIONS } = {},
): Promise<EncryptedBackup> {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const key = await deriveKey(password, salt, iterations)
  const data = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    new TextEncoder().encode(plaintext),
  )
  return {
    format: ENCRYPTED_FORMAT,
    version: VERSION,
    exportedAt,
    kdf: { name: 'PBKDF2', hash: 'SHA-256', iterations, salt: toBase64(salt) },
    cipher: { name: 'AES-GCM', iv: toBase64(iv) },
    data: toBase64(new Uint8Array(data)),
  }
}

/** The protected backup in `value`, or `null` if it isn't one. */
export function asEncryptedBackup(value: unknown): EncryptedBackup | null {
  if (!isRecord(value) || value.format !== ENCRYPTED_FORMAT) return null
  const { version, kdf, cipher, data } = value
  if (typeof version !== 'number' || version > VERSION)
    throw new Error('This backup is from a newer version of Momentum.')
  if (
    !isRecord(kdf) ||
    kdf.name !== 'PBKDF2' ||
    kdf.hash !== 'SHA-256' ||
    typeof kdf.salt !== 'string' ||
    typeof kdf.iterations !== 'number' ||
    !isRecord(cipher) ||
    cipher.name !== 'AES-GCM' ||
    typeof cipher.iv !== 'string' ||
    typeof data !== 'string'
  ) {
    throw new Error("This protected backup is damaged and can't be read.")
  }
  if (kdf.iterations < MIN_ITERATIONS || kdf.iterations > MAX_ITERATIONS)
    throw new Error("This protected backup is damaged and can't be read.")
  return value as unknown as EncryptedBackup
}

export async function decryptBackup(
  backup: EncryptedBackup,
  password: string,
): Promise<string> {
  try {
    const key = await deriveKey(
      password,
      fromBase64(backup.kdf.salt),
      backup.kdf.iterations,
    )
    const plain = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: fromBase64(backup.cipher.iv) },
      key,
      fromBase64(backup.data),
    )
    return new TextDecoder().decode(plain)
  } catch {
    // AES-GCM can't tell a wrong password from altered data; both fail here.
    throw new WrongPasswordError()
  }
}

/**
 * A backup file's text, ready for `parseBackup`: decrypted first if it's
 * protected (which needs the password).
 */
export async function unlockBackupText(
  text: string,
  password?: string,
): Promise<string> {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    return text // Not JSON: parseBackup explains.
  }
  const encrypted = asEncryptedBackup(parsed)
  if (!encrypted) return text
  if (!password) throw new PasswordNeededError()
  return decryptBackup(encrypted, password)
}
