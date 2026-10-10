import { isRecord } from '@/lib/guards'
import { createPersistentStore } from '@/lib/persistentStore'
import { parseTime } from './lib/schedule'

export interface ReminderSettings {
  enabled: boolean
  /** Local time, "HH:MM". */
  time: string
}

export const reminderStore = createPersistentStore<ReminderSettings>({
  key: 'momentum.reminder',
  version: 1,
  defaultValue: { enabled: false, time: '20:00' },
  parse(data) {
    if (!isRecord(data)) return null
    const time =
      typeof data.time === 'string'
        ? parseTime(data.time)
        : { hours: 20, minutes: 0 }
    return {
      enabled: data.enabled === true,
      time: `${String(time.hours).padStart(2, '0')}:${String(time.minutes).padStart(2, '0')}`,
    }
  },
})

export const notificationsSupported = () =>
  typeof window !== 'undefined' && 'Notification' in window

/** Asks for permission, then turns the reminder on. Returns a reason if it couldn't. */
export async function enableReminder(): Promise<string | null> {
  if (!notificationsSupported()) {
    return /iPhone|iPad|iPod/.test(navigator.userAgent)
      ? 'On iPhone and iPad, add Momentum to your Home Screen first, then turn this on from the app.'
      : "This browser doesn't support notifications."
  }
  const permission =
    Notification.permission === 'default'
      ? await Notification.requestPermission()
      : Notification.permission
  if (permission !== 'granted') {
    return 'Notifications are blocked for this site. Allow them in your browser settings to get reminders.'
  }
  reminderStore.set((previous) => ({ ...previous, enabled: true }))
  await registerPeriodicSync()
  return null
}

export function disableReminder(): void {
  reminderStore.set((previous) => ({ ...previous, enabled: false }))
}

export function setReminderTime(time: string): void {
  reminderStore.set((previous) => ({ ...previous, time }))
}

type PeriodicSyncRegistration = ServiceWorkerRegistration & {
  periodicSync?: {
    register(tag: string, options: { minInterval: number }): Promise<void>
  }
}

/**
 * Chromium lets an installed app wake its service worker now and then, so a
 * reminder can arrive even when Momentum is closed. Timing is up to the
 * browser, so this is a bonus on top of the in-app reminder.
 */
async function registerPeriodicSync(): Promise<void> {
  try {
    const registration = (await navigator.serviceWorker?.getRegistration()) as
      PeriodicSyncRegistration | undefined
    if (!registration?.periodicSync) return
    const status = await navigator.permissions.query({
      name: 'periodic-background-sync' as PermissionName,
    })
    if (status.state !== 'granted') return
    await registration.periodicSync.register('evening-reminder', {
      minInterval: 60 * 60 * 1000,
    })
  } catch {
    // Not supported here; the in-app reminder still works.
  }
}
