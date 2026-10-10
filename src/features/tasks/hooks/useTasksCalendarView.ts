import { useMemo } from 'react'
import type { CalendarView } from '@/features/calendar'
import { addDays, formatDateKey, toDateKey, type DateKey } from '@/lib/date'
import { completedByDay } from '../lib/groups'
import { useTasks } from './useTasks'

/** Tasks finished in a day at which it reaches each calendar level (1–4). */
const LEVELS = [1, 3, 5, 8]

const levelFor = (count: number) =>
  LEVELS.reduce(
    (level, threshold) => (count >= threshold ? level + 1 : level),
    0,
  )

/** The calendar view of tasks: brighter the more you finished. */
export function useTasksCalendarView(today: DateKey): CalendarView {
  const tasks = useTasks()
  return useMemo(() => {
    const counts = completedByDay(tasks, (iso) => toDateKey(new Date(iso)))
    const yearAgo = addDays(today, -364)
    let total = 0
    for (const [day, count] of counts)
      if (day >= yearAgo && day <= today) total += count
    return {
      id: 'tasks',
      label: 'Tasks',
      levels: new Map(
        [...counts].map(([day, count]) => [day, levelFor(count)]),
      ),
      describe(date: DateKey) {
        const day = formatDateKey(date, {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        })
        const count = counts.get(date) ?? 0
        return `${day} · ${count === 0 ? 'No tasks done' : `${count} ${count === 1 ? 'task' : 'tasks'} done`}`
      },
      summary: `${total} ${total === 1 ? 'task' : 'tasks'} done in the past year`,
      note: 'Brighter days had more tasks done.',
    }
  }, [tasks, today])
}
