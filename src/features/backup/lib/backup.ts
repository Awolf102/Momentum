import { isRecord } from '@/lib/guards'
import {
  isEnvelope,
  storeRegistry,
  type StoredEnvelope,
  type StoreRegistry,
} from '@/lib/persistentStore'

export const BACKUP_FORMAT = 'momentum-backup'
export const BACKUP_VERSION = 2

export interface BackupPhoto {
  key: string
  type: string
  /** Base64-encoded bytes. */
  data: string
}

export interface Backup {
  format: typeof BACKUP_FORMAT
  version: number
  exportedAt: string
  stores: Record<string, StoredEnvelope>
  photos: BackupPhoto[]
  /** Only present when the user chose to include API keys. */
  secrets?: Record<string, string>
}

/** Where a backup reads and writes photos and secrets (swappable in tests). */
export interface BackupSources {
  registry: StoreRegistry
  listPhotos(): Promise<Array<{ key: string; blob: Blob }>>
  putPhoto(key: string, blob: Blob): Promise<void>
  getSecrets(): Promise<Record<string, string>>
  setSecret(name: string, value: string): Promise<void>
}

export async function blobToBase64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer())
  let binary = ''
  for (let index = 0; index < bytes.length; index += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000))
  }
  return btoa(binary)
}

export function base64ToBlob(data: string, type: string): Blob {
  const binary = atob(data)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index++)
    bytes[index] = binary.charCodeAt(index)
  return new Blob([bytes], { type })
}

/** Everything Momentum stores on this device, as one object. */
export async function createBackup(
  sources: BackupSources,
  options: { includeSecrets: boolean },
): Promise<Backup> {
  const photos = await Promise.all(
    (await sources.listPhotos()).map(async ({ key, blob }) => ({
      key,
      type: blob.type || 'image/jpeg',
      data: await blobToBase64(blob),
    })),
  )
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    stores: await sources.registry.snapshotAll(),
    photos,
    ...(options.includeSecrets ? { secrets: await sources.getSecrets() } : {}),
  }
}

/**
 * Reads a backup file's contents. Accepts this format and the v1 format
 * (streak only), which it upgrades.
 */
export function parseBackup(text: string): Backup {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new Error("That file isn't a Momentum backup.")
  }
  if (!isRecord(parsed) || parsed.format !== BACKUP_FORMAT) {
    throw new Error("That file isn't a Momentum backup.")
  }
  const exportedAt =
    typeof parsed.exportedAt === 'string' ? parsed.exportedAt : ''
  // v1 backups held only the streak, under `streak`.
  if (parsed.version === undefined && isEnvelope(parsed.streak)) {
    return {
      format: BACKUP_FORMAT,
      version: 1,
      exportedAt,
      stores: { 'momentum.streak': parsed.streak },
      photos: [],
    }
  }
  if (typeof parsed.version !== 'number' || parsed.version > BACKUP_VERSION) {
    throw new Error('This backup is from a newer version of Momentum.')
  }
  const stores: Record<string, StoredEnvelope> = {}
  if (isRecord(parsed.stores)) {
    for (const [key, envelope] of Object.entries(parsed.stores)) {
      if (isEnvelope(envelope)) stores[key] = envelope
    }
  }
  const photos = Array.isArray(parsed.photos)
    ? parsed.photos.filter(
        (photo): photo is BackupPhoto =>
          isRecord(photo) &&
          typeof photo.key === 'string' &&
          typeof photo.type === 'string' &&
          typeof photo.data === 'string',
      )
    : []
  const secrets = isRecord(parsed.secrets)
    ? Object.fromEntries(
        Object.entries(parsed.secrets).filter(
          (entry): entry is [string, string] => typeof entry[1] === 'string',
        ),
      )
    : undefined
  return {
    format: BACKUP_FORMAT,
    version: parsed.version,
    exportedAt,
    stores,
    photos,
    secrets,
  }
}

export interface RestoreReport {
  restored: string[]
  skipped: string[]
  photos: number
  secrets: number
}

/**
 * Applies a backup. Each store decides how: most replace what's here; the
 * streak combines check-ins so restoring never erases progress. Data for
 * stores that aren't loaded yet is saved for later. Photos are added; API
 * keys only if the backup has them and the user agreed.
 */
export async function restoreBackup(
  backup: Backup,
  sources: BackupSources,
  options: { includeSecrets: boolean },
): Promise<RestoreReport> {
  const report: RestoreReport = {
    restored: [],
    skipped: [],
    photos: 0,
    secrets: 0,
  }
  for (const [key, envelope] of Object.entries(backup.stores)) {
    if (await sources.registry.restore(key, envelope)) report.restored.push(key)
    else report.skipped.push(key)
  }
  for (const photo of backup.photos) {
    await sources.putPhoto(photo.key, base64ToBlob(photo.data, photo.type))
    report.photos++
  }
  if (options.includeSecrets && backup.secrets) {
    for (const [name, value] of Object.entries(backup.secrets)) {
      await sources.setSecret(name, value)
      report.secrets++
    }
  }
  await sources.registry.flush()
  return report
}

export { storeRegistry }
