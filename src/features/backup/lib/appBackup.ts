import { listAllPhotos, putPhoto } from '@/features/appearance'
import { toDateKey } from '@/lib/date'
import { storeRegistry } from '@/lib/persistentStore'
import { getAllSecrets, setSecret } from '@/lib/secrets'
import {
  createBackup,
  parseBackup,
  restoreBackup,
  type BackupSources,
  type RestoreReport,
} from './backup'

const appSources: BackupSources = {
  registry: storeRegistry,
  listPhotos: listAllPhotos,
  putPhoto,
  getSecrets: getAllSecrets,
  setSecret,
}

/** Downloads a backup of everything on this device. */
export async function downloadBackup(options: {
  includeSecrets: boolean
}): Promise<void> {
  const backup = await createBackup(appSources, options)
  const blob = new Blob([JSON.stringify(backup)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `momentum-backup-${toDateKey(new Date())}.json`
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 0)
}

/** Reads a backup file and applies it. */
export async function importBackupFile(
  file: File,
  options: { includeSecrets: boolean },
): Promise<RestoreReport & { hadSecrets: boolean }> {
  const backup = parseBackup(await file.text())
  const report = await restoreBackup(backup, appSources, options)
  return { ...report, hadSecrets: Boolean(backup.secrets) }
}
