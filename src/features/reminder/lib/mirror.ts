// Relative imports only: this file is also bundled into the service worker.
import { openDB } from 'idb'
import type { ReminderMirror } from './schedule'

/**
 * The service worker can't read the app's stores, so the bits it needs for
 * reminders are copied into a small IndexedDB database of their own. (Created
 * by idb-keyval in earlier versions; same name, version and store.)
 */
const db = () =>
  openDB('momentum-reminder', 1, {
    upgrade(database) {
      database.createObjectStore('state')
    },
  })

export async function readMirror(): Promise<ReminderMirror | undefined> {
  const database = await db()
  try {
    return (await database.get('state', 'state')) as ReminderMirror | undefined
  } finally {
    database.close()
  }
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
  const database = await db()
  try {
    await database.put('state', next, 'state')
  } finally {
    database.close()
  }
  return next
}
