import type { CollectionRecord } from '@/lib/collection'
import { isRecord } from '@/lib/guards'
import {
  isEnvelope,
  storeRegistry,
  type StoredEnvelope,
  type StoreRegistry,
} from '@/lib/persistentStore'

export const BACKUP_FORMAT = 'momentum-backup'
export const BACKUP_VERSION = 3

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
  /**
   * Library files (PDFs and their first-page pictures), unless left out.
   * Optional: older backups have none.
   */
  files: BackupPhoto[]
  /** Collections (e.g. focus sessions), every record. Since version 3. */
  collections: Record<string, CollectionRecord[]>
  /** Only present when the user chose to include API keys. */
  secrets?: Record<string, string>
}

/** Where a backup reads and writes everything (swappable in tests). */
export interface BackupSources {
  registry: StoreRegistry
  listPhotos(): Promise<Array<{ key: string; blob: Blob }>>
  putPhoto(key: string, blob: Blob): Promise<void>
  listFiles(): Promise<Array<{ key: string; blob: Blob }>>
  putFile(key: string, blob: Blob): Promise<void>
  exportCollections(): Promise<Record<string, CollectionRecord[]>>
  /** Merges records in; returns how many were new or newer. */
  importCollection(name: string, records: readonly unknown[]): Promise<number>
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
const encode =
  (fallbackType: string) =>
  async ({ key, blob }: { key: string; blob: Blob }): Promise<BackupPhoto> => ({
    key,
    type: blob.type || fallbackType,
    data: await blobToBase64(blob),
  })

export async function createBackup(
  sources: BackupSources,
  options: { includeSecrets: boolean; includeFiles?: boolean },
): Promise<Backup> {
  const photos = await Promise.all(
    (await sources.listPhotos()).map(encode('image/jpeg')),
  )
  const files =
    options.includeFiles === false
      ? []
      : await Promise.all(
          (await sources.listFiles()).map(encode('application/pdf')),
        )
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    stores: await sources.registry.snapshotAll(),
    photos,
    files,
    collections: await sources.exportCollections(),
    ...(options.includeSecrets ? { secrets: await sources.getSecrets() } : {}),
  }
}

/**
 * Reads a backup file's contents. Accepts this format, v2 (no collections)
 * and v1 (streak only), which it upgrades.
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
      files: [],
      collections: {},
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
  const blobs = (value: unknown) =>
    Array.isArray(value)
      ? value.filter(
          (item): item is BackupPhoto =>
            isRecord(item) &&
            typeof item.key === 'string' &&
            typeof item.type === 'string' &&
            typeof item.data === 'string',
        )
      : []
  const photos = blobs(parsed.photos)
  const files = blobs(parsed.files)
  // Records are checked one by one when restored.
  const collections: Record<string, CollectionRecord[]> = {}
  if (isRecord(parsed.collections)) {
    for (const [name, records] of Object.entries(parsed.collections)) {
      if (Array.isArray(records))
        collections[name] = records as CollectionRecord[]
    }
  }
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
    files,
    collections,
    secrets,
  }
}

export interface RestoreReport {
  restored: string[]
  skipped: string[]
  photos: number
  /** Library files (PDFs; not counting their pictures). */
  files: number
  /** Per collection: records that were new or newer than what's here. */
  records: Record<string, number>
  secrets: number
}

/**
 * Applies a backup. Each store decides how: most replace what's here; the
 * streak combines check-ins so restoring never erases progress. Data for
 * stores that aren't loaded yet is saved for later. Photos are added, and
 * collection records merged (the newer copy of each wins). API keys only if
 * the backup has them and the user agreed.
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
    files: 0,
    records: {},
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
  for (const file of backup.files) {
    await sources.putFile(file.key, base64ToBlob(file.data, file.type))
    if (!file.key.endsWith(':thumb')) report.files++
  }
  for (const [name, records] of Object.entries(backup.collections)) {
    const count = await sources.importCollection(name, records)
    if (count > 0) report.records[name] = count
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
