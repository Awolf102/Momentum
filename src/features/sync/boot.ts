import { getDb } from '@/lib/db/db'

/** Starts sync if this device is signed in; its code loads only then. */
export async function bootSync(): Promise<void> {
  try {
    const account = await (await getDb()).get('meta', 'sync:account')
    if (!account) return
    const { startSync } = await import('./manager')
    startSync()
  } catch {
    // No IndexedDB, no sync.
  }
}
