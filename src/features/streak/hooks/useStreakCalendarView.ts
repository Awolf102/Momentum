import { useMemo } from 'react'
import type { CalendarView } from '@/features/calendar'
import { addDays, formatDateKey, type DateKey } from '@/lib/date'
import { depthToLevel, streakDepths } from '../lib/streak'
import type { StreakState } from './useStreak'

/** The calendar view of check-ins: brighter the deeper a day is into a streak. */
export function useStreakCalendarView(streak: StreakState): CalendarView {
  const { dates, today } = streak
  return useMemo(() => {
    const depths = streakDepths(dates)
    const levels = new Map(
      [...depths].map(([date, depth]) => [date, depthToLevel(depth)]),
    )
    const yearAgo = addDays(today, -364)
    const pastYear = dates.filter(
      (date) => date >= yearAgo && date <= today,
    ).length
    return {
      id: 'check-ins',
      label: 'Check-ins',
      levels,
      describe(date: DateKey) {
        const day = formatDateKey(date, {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        })
        const depth = depths.get(date)
        if (!depth) return `${day} · No check-in`
        return depth === 1
          ? `${day} · Checked in`
          : `${day} · Day ${depth} of a streak`
      },
      summary: `${pastYear} ${pastYear === 1 ? 'check-in' : 'check-ins'} in the past year`,
      note: 'Brighter days are deeper into a streak.',
    }
  }, [dates, today])
}
