import { isDateKey, toDateKey, type DateKey } from '@/lib/date'
import { isRecord } from '@/lib/guards'
import { createPersistentStore } from '@/lib/persistentStore'
import type { CheckIn, StreakData } from './types'

export function parseStreakData(data: unknown): StreakData | null {
  if (!isRecord(data) || !isRecord(data.checkIns)) return null
  const checkIns: Record<DateKey, CheckIn> = {}
  for (const [date, value] of Object.entries(data.checkIns)) {
    if (isDateKey(date) && isRecord(value) && typeof value.at === 'string') {
      checkIns[date] = { at: value.at }
    }
  }
  return { checkIns }
}

export const streakStore = createPersistentStore<StreakData>({
  key: 'momentum.streak',
  version: 1,
  defaultValue: { checkIns: {} },
  parse: parseStreakData,
  // Restoring a backup never erases progress: check-ins are combined.
  merge: (current, incoming) => ({
    checkIns: { ...incoming.checkIns, ...current.checkIns },
  }),
})

const checkInListeners = new Set<(day: DateKey) => void>()

/**
 * Runs `listener` whenever a check-in is recorded in this tab — from the
 * button, a keyboard shortcut, the command palette or a finished focus
 * session — with the day it was for. Returns an unsubscribe.
 */
export function onCheckIn(listener: (day: DateKey) => void): () => void {
  checkInListeners.add(listener)
  return () => checkInListeners.delete(listener)
}

/**
 * Records a check-in. By default for the current local day, reading the
 * clock at call time, so a screen left open past midnight still records the
 * right day. `day` names another day (a focus session that crossed midnight
 * counts for the day it started). Returns `false` if that day was already
 * checked in: one check-in per calendar day.
 */
export function checkIn(
  now: Date = new Date(),
  { day = toDateKey(now) }: { day?: DateKey } = {},
): boolean {
  if (streakStore.get().checkIns[day]) return false
  streakStore.set((previous) => ({
    ...previous,
    checkIns: { ...previous.checkIns, [day]: { at: now.toISOString() } },
  }))
  for (const listener of checkInListeners) listener(day)
  return true
}

export function isCheckedIn(day: DateKey): boolean {
  return Boolean(streakStore.get().checkIns[day])
}

/** Adds check-ins from another history (e.g. a backup) without removing any. Returns how many were new. */
export function mergeCheckIns(incoming: StreakData): number {
  const current = streakStore.get().checkIns
  const added = Object.keys(incoming.checkIns).filter((date) => !current[date])
  if (added.length > 0) {
    streakStore.set((previous) => ({
      ...previous,
      checkIns: { ...incoming.checkIns, ...previous.checkIns },
    }))
  }
  return added.length
}

export function resetStreak(): void {
  streakStore.reset()
}
