import { useMemo } from 'react'
import type { DateKey } from '@/lib/date'
import { useStore } from '@/lib/store'
import { habitCheckIns } from '../checkIns'
import { habitsStore, liveHabits } from '../store'
import type { Habit } from '../types'

/** The habits, in order. */
export function useHabits(): Habit[] {
  const data = useStore(habitsStore)
  return useMemo(() => liveHabits(data), [data])
}

/** The days each habit was done, by habit id. */
export function useHabitDays(): ReadonlyMap<string, ReadonlySet<DateKey>> {
  const records = useStore(habitCheckIns)
  return useMemo(() => {
    const days = new Map<string, Set<DateKey>>()
    for (const record of records) {
      let set = days.get(record.habitId)
      if (!set) days.set(record.habitId, (set = new Set()))
      set.add(record.day)
    }
    return days
  }, [records])
}
