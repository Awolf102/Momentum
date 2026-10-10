import { useMemo } from 'react'
import type { DateKey } from '@/lib/date'
import { useStore } from '@/lib/store'
import { totalsByDay, type DayTotal } from '../lib/stats'
import { focusSessions } from '../sessions'

/** Focus per day (minutes, sessions, minutes per subject), kept up to date. */
export function useFocusTotals(): ReadonlyMap<DateKey, DayTotal> {
  const sessions = useStore(focusSessions)
  return useMemo(() => totalsByDay(sessions), [sessions])
}
