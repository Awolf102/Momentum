import { useMemo } from 'react'
import { useStore } from '@/lib/persistentStore'
import { useToday } from '@/lib/useToday'
import { sortedCheckInDates, summarizeStreak } from '../lib/streak'
import { checkIn, streakStore } from '../store'

/** Everything the UI needs to know about the streak, kept in sync with storage and the clock. */
export function useStreak() {
  const data = useStore(streakStore)
  const today = useToday()
  const dates = useMemo(() => sortedCheckInDates(data), [data])
  const summary = useMemo(() => summarizeStreak(dates, today), [dates, today])
  return { ...summary, dates, today, checkIn }
}

export type StreakState = ReturnType<typeof useStreak>
