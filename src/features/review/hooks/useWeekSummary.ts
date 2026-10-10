import { useMemo } from 'react'
import { focusSessions } from '@/features/focus'
import { goals } from '@/features/goals/data'
import { useHabitDays, useHabits } from '@/features/habits'
import { logEntries } from '@/features/log'
import { sortedCheckInDates, streakStore } from '@/features/streak'
import { subjectsStore } from '@/features/subjects'
import { tasks } from '@/features/tasks'
import type { DateKey } from '@/lib/date'
import { useStore } from '@/lib/store'
import { useToday } from '@/lib/useToday'
import { summarizeWeek, type WeekSummary } from '../lib/week'

/** A week in numbers, from what's on this device, kept up to date. */
export function useWeekSummary(start: DateKey): WeekSummary {
  const today = useToday()
  const sessions = useStore(focusSessions)
  const streak = useStore(streakStore)
  const habits = useHabits()
  const habitDays = useHabitDays()
  const allTasks = useStore(tasks)
  const log = useStore(logEntries)
  const allGoals = useStore(goals)
  const { subjects } = useStore(subjectsStore)
  return useMemo(
    () =>
      summarizeWeek({
        start,
        today,
        sessions,
        checkIns: sortedCheckInDates(streak),
        habits,
        habitDays,
        tasks: allTasks,
        log,
        goals: allGoals,
        subjects: new Map(
          subjects.map((subject) => [subject.id, subject.name]),
        ),
      }),
    [
      start,
      today,
      sessions,
      streak,
      habits,
      habitDays,
      allTasks,
      log,
      allGoals,
      subjects,
    ],
  )
}
