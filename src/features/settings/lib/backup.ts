import { mergeCheckIns, streakStore } from '@/features/streak'
import { toDateKey } from '@/lib/date'
import { isRecord } from '@/lib/guards'

const BACKUP_FORMAT = 'momentum-backup'

/** Downloads the streak history as a JSON file. */
export function exportBackup(): void {
  const backup = {
    format: BACKUP_FORMAT,
    exportedAt: new Date().toISOString(),
    streak: streakStore.toEnvelope(),
  }
  const blob = new Blob([JSON.stringify(backup, null, 2)], {
    type: 'application/json',
  })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `momentum-backup-${toDateKey(new Date())}.json`
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 0)
}

/**
 * Restores check-ins from a backup file. Check-ins are merged with what's
 * already here, so importing can never erase progress.
 */
export async function importBackup(file: File): Promise<{ added: number }> {
  let parsed: unknown
  try {
    parsed = JSON.parse(await file.text())
  } catch {
    throw new Error("That file isn't a Momentum backup.")
  }
  if (!isRecord(parsed) || parsed.format !== BACKUP_FORMAT) {
    throw new Error("That file isn't a Momentum backup.")
  }
  const streak = streakStore.decode(parsed.streak)
  if (!streak)
    throw new Error(
      'This backup is damaged or from a newer version of Momentum.',
    )
  return { added: mergeCheckIns(streak) }
}
