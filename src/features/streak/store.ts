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
})

const checkInListeners = new Set<() => void>()

/**
 * Runs `listener` whenever a check-in is recorded in this tab — from the
 * button, a keyboard shortcut or the command palette. Returns an unsubscribe.
 */
export function onCheckIn(listener: () => void): () => void {
  checkInListeners.add(listener)
  return () => checkInListeners.delete(listener)
}

/**
 * Records a check-in for the current local day.
 * Reads the clock at call time, so a screen left open past midnight still
 * records the right day. Returns `false` if today was already checked in.
 */
export function checkIn(now: Date = new Date()): boolean {
  const today = toDateKey(now)
  if (streakStore.get().checkIns[today]) return false
  streakStore.set((previous) => ({
    ...previous,
    checkIns: { ...previous.checkIns, [today]: { at: now.toISOString() } },
  }))
  for (const listener of checkInListeners) listener()
  return true
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
