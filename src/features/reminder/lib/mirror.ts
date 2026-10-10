// Relative imports only: this file is also bundled into the service worker.
import { createStore, get, set } from 'idb-keyval'
import type { ReminderMirror } from './schedule'

/**
 * The service worker can't read localStorage, so the bits it needs for
 * reminders are copied into IndexedDB.
 */
let database: ReturnType<typeof createStore> | undefined
const db = () => (database ??= createStore('momentum-reminder', 'state'))

export function readMirror(): Promise<ReminderMirror | undefined> {
  return get<ReminderMirror>('state', db())
}

export async function writeMirror(
  update: Partial<ReminderMirror>,
): Promise<ReminderMirror> {
  const current: ReminderMirror = (await readMirror()) ?? {
    enabled: false,
    time: '20:00',
    lastCheckIn: null,
    lastNotified: null,
    streak: 0,
  }
  const next = { ...current, ...update }
  await set('state', next, db())
  return next
}
