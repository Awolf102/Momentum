import { listAllPhotos, putPhoto } from '@/features/appearance'
import { listAllFiles, putFile } from '@/features/library'
import { collectionRegistry } from '@/lib/collection'
import { toDateKey } from '@/lib/date'
import { COLLECTION_STORES } from '@/lib/db/schema'
import { storeRegistry } from '@/lib/persistentStore'
import { getAllSecrets, setSecret } from '@/lib/secrets'
import {
  createBackup,
  parseBackup,
  restoreBackup,
  type BackupSources,
  type RestoreReport,
} from './backup'
import { encryptBackup, unlockBackupText } from './crypto'

/** Sync's session and key belong to this device: never in a backup. */
const deviceOnly = (name: string) => name.startsWith('sync:')

/** The secrets a backup with keys carries. */
export async function backupSecrets(): Promise<Record<string, string>> {
  return Object.fromEntries(
    Object.entries(await getAllSecrets()).filter(([name]) => !deviceOnly(name)),
  )
}

/** Restores a secret from a backup (a device's own ones are left alone). */
export const restoreSecret = (name: string, value: string): Promise<void> =>
  deviceOnly(name) ? Promise.resolve() : setSecret(name, value)

const appSources: BackupSources = {
  registry: storeRegistry,
  listPhotos: listAllPhotos,
  putPhoto,
  listFiles: listAllFiles,
  putFile,
  exportCollections: () => collectionRegistry.exportAll(COLLECTION_STORES),
  importCollection: (name, records) =>
    (COLLECTION_STORES as readonly string[]).includes(name)
      ? collectionRegistry.importRecords(name, records)
      : Promise.resolve(0),
  getSecrets: backupSecrets,
  setSecret: restoreSecret,
}

/**
 * Downloads a backup of everything on this device, encrypted with
 * `password` if there is one. A backup with API keys always needs one.
 */
export async function downloadBackup(options: {
  includeSecrets: boolean
  includeFiles: boolean
  password?: string
}): Promise<void> {
  if (options.includeSecrets && !options.password)
    throw new Error('A backup with API keys needs a password.')
  const backup = await createBackup(appSources, options)
  let content = JSON.stringify(backup)
  if (options.password) {
    content = JSON.stringify(
      await encryptBackup(content, options.password, {
        exportedAt: backup.exportedAt,
      }),
    )
  }
  const blob = new Blob([content], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `momentum-backup-${toDateKey(new Date())}${options.password ? '-protected' : ''}.json`
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 0)
}

/**
 * Reads a backup file and applies it. A protected one needs its password
 * (`PasswordNeededError` without it, `WrongPasswordError` if it's wrong).
 */
export async function importBackupFile(
  file: File,
  options: { includeSecrets: boolean; password?: string },
): Promise<RestoreReport & { hadSecrets: boolean }> {
  const backup = parseBackup(
    await unlockBackupText(await file.text(), options.password),
  )
  const report = await restoreBackup(backup, appSources, options)
  return { ...report, hadSecrets: Boolean(backup.secrets) }
}
