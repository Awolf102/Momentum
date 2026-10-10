import { indexedDbAvailable } from '@/lib/db/db'

export interface StorageStatus {
  database: boolean
  /** Whether the browser has agreed not to clear Momentum's data. */
  persisted: boolean | null
  usedBytes: number | null
  quotaBytes: number | null
}

export async function readStorageStatus(): Promise<StorageStatus> {
  const storage =
    typeof navigator === 'undefined' ? undefined : navigator.storage
  const [persisted, estimate] = await Promise.all([
    storage?.persisted?.().catch(() => null) ?? null,
    storage?.estimate?.().catch(() => null) ?? null,
  ])
  return {
    database: indexedDbAvailable(),
    persisted,
    usedBytes: estimate?.usage ?? null,
    quotaBytes: estimate?.quota ?? null,
  }
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  const units = ['KB', 'MB', 'GB', 'TB']
  let value = bytes / 1024
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit++
  }
  return `${value < 10 ? value.toFixed(1) : Math.round(value)} ${units[unit]}`
}
