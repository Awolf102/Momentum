// Relative imports only: this file is also bundled into the service worker.
import { toDateKey, type DateKey } from '../../../lib/date'

/** What the service worker needs to decide on a reminder (mirrored to IndexedDB). */
export interface ReminderMirror {
  enabled: boolean
  /** Local time, "HH:MM". */
  time: string
  lastCheckIn: DateKey | null
  lastNotified: DateKey | null
  streak: number
}

export function parseTime(time: string): { hours: number; minutes: number } {
  const [hours, minutes] = time.split(':').map(Number)
  return {
    hours: Number.isFinite(hours) ? Math.min(23, Math.max(0, hours)) : 20,
    minutes: Number.isFinite(minutes) ? Math.min(59, Math.max(0, minutes)) : 0,
  }
}

/**
 * A reminder is due once per day, after the reminder time, and only if the
 * user hasn't checked in today.
 */
export function reminderDue(state: ReminderMirror, now: Date): boolean {
  if (!state.enabled) return false
  const today = toDateKey(now)
  if (state.lastCheckIn === today || state.lastNotified === today) return false
  const { hours, minutes } = parseTime(state.time)
  return now.getHours() * 60 + now.getMinutes() >= hours * 60 + minutes
}

/** Milliseconds until the reminder time next comes round (today or tomorrow). */
export function msUntilReminder(time: string, now: Date): number {
  const { hours, minutes } = parseTime(time)
  const next = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    hours,
    minutes,
  )
  if (next.getTime() <= now.getTime()) next.setDate(next.getDate() + 1)
  return next.getTime() - now.getTime()
}

export function reminderMessage(streak: number): {
  title: string
  body: string
} {
  return streak > 0
    ? {
        title: 'Your streak is waiting',
        body: `Check in to keep your ${streak}-day streak alive.`,
      }
    : {
        title: 'Make today count',
        body: 'A few focused minutes is enough. Check in for today.',
      }
}

export const REMINDER_TAG = 'evening-reminder'
