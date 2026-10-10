import { useMemo } from 'react'
import type { CalendarView } from '@/features/calendar'
import { addDays, formatDateKey, type DateKey } from '@/lib/date'
import { useStore } from '@/lib/store'
import { focusLevels, formatMinutes, totalsByDay } from '../lib/stats'
import { focusSessions } from '../sessions'

/** The calendar view of focus: brighter the more minutes you focused. */
export function useFocusCalendarView(today: DateKey): CalendarView {
  const sessions = useStore(focusSessions)
  return useMemo(() => {
    const totals = totalsByDay(sessions)
    const yearAgo = addDays(today, -364)
    let minutes = 0
    for (const [day, total] of totals)
      if (day >= yearAgo && day <= today) minutes += total.minutes
    return {
      id: 'focus',
      label: 'Focus',
      levels: focusLevels(totals),
      describe(date: DateKey) {
        const day = formatDateKey(date, {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        })
        const total = totals.get(date)
        if (!total) return `${day} · No focus`
        return `${day} · ${formatMinutes(total.minutes)} · ${total.sessions} ${total.sessions === 1 ? 'session' : 'sessions'}`
      },
      summary: `${formatMinutes(minutes)} of focus in the past year`,
      note: 'Brighter days had more focus minutes.',
    }
  }, [sessions, today])
}
