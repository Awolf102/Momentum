import { useMemo } from 'react'
import type { CalendarView } from '@/features/calendar'
import { addDays, formatDateKey, localDay, type DateKey } from '@/lib/date'
import { isScheduled } from '../lib/summary'
import { useHabitDays, useHabits } from './useHabits'

/**
 * The calendar view of habits: how much of each day's habits you did. A day
 * with every due habit done is brightest; extra days count too.
 */
export function useHabitsCalendarView(today: DateKey): CalendarView {
  const habits = useHabits()
  const days = useHabitDays()
  return useMemo(() => {
    const levels = new Map<DateKey, number>()
    const counts = new Map<DateKey, { done: number; due: number }>()
    const yearAgo = addDays(today, -364)
    let total = 0
    for (const habit of habits) {
      const since = localDay(habit.createdAt)
      for (const day of days.get(habit.id) ?? []) {
        if (day > today) continue
        const count = counts.get(day) ?? { done: 0, due: 0 }
        count.done++
        counts.set(day, count)
        if (day >= yearAgo) total++
      }
      // Due days count toward the share, from the day the habit began.
      for (
        let day = since > yearAgo ? since : yearAgo;
        day <= today;
        day = addDays(day, 1)
      ) {
        if (!isScheduled(day, habit.weekdays)) continue
        const count = counts.get(day) ?? { done: 0, due: 0 }
        count.due++
        counts.set(day, count)
      }
    }
    for (const [day, { done, due }] of counts) {
      if (done === 0) continue
      const share = due === 0 ? 1 : Math.min(1, done / due)
      levels.set(
        day,
        share >= 1 ? 4 : share >= 0.67 ? 3 : share >= 0.34 ? 2 : 1,
      )
    }
    return {
      id: 'habits',
      label: 'Habits',
      levels,
      describe(date: DateKey) {
        const label = formatDateKey(date, {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        })
        const count = counts.get(date)
        if (!count || count.done === 0) return `${label} · No habits done`
        return `${label} · ${count.done}${count.due ? ` of ${count.due}` : ''} ${count.due === 1 || (!count.due && count.done === 1) ? 'habit' : 'habits'} done`
      },
      summary: `${total} ${total === 1 ? 'habit' : 'habits'} done in the past year`,
      note: 'Brighter days had more of their habits done.',
    }
  }, [habits, days, today])
}
