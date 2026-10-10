import { useMemo } from 'react'
import {
  summarizeHabit,
  useHabitDays,
  useHabits,
  type Habit,
  type HabitSummary,
} from '@/features/habits'
import { tasks } from '@/features/tasks'
import { localDay, type DateKey } from '@/lib/date'
import { useStore } from '@/lib/store'
import { useToday } from '@/lib/useToday'
import { goals, sortGoals } from '../goals'
import {
  goalProgress,
  linkedTasks,
  type GoalProgress,
  type LinkedTask,
} from '../lib/progress'
import type { Goal } from '../types'

export interface LinkedHabit {
  habit: Habit
  summary: HabitSummary
}

/** A goal with what's linked to it and how it's going. */
export interface GoalView {
  goal: Goal
  tasks: LinkedTask[]
  habits: LinkedHabit[]
  progress: GoalProgress
}

const NONE: ReadonlySet<DateKey> = new Set()

/** Every goal (active ones first, in their order), with its progress. */
export function useGoalViews(): GoalView[] {
  const all = useStore(goals)
  const allTasks = useStore(tasks)
  const habits = useHabits()
  const days = useHabitDays()
  const today = useToday()
  return useMemo(() => {
    const habitsById = new Map(habits.map((habit) => [habit.id, habit]))
    return sortGoals(all).map((goal) => {
      const linked = linkedTasks(goal.taskIds, allTasks)
      // A deleted habit drops out, and comes back if it's restored.
      const linkedHabits = goal.habitIds.flatMap((id) => {
        const habit = habitsById.get(id)
        if (!habit) return []
        const summary = summarizeHabit(
          days.get(id) ?? NONE,
          today,
          habit.weekdays,
          localDay(habit.createdAt),
        )
        return [{ habit, summary }]
      })
      return {
        goal,
        tasks: linked,
        habits: linkedHabits,
        progress: goalProgress(
          goal,
          linked,
          linkedHabits.map(({ summary }) => summary.rate),
          today,
        ),
      }
    })
  }, [all, allTasks, habits, days, today])
}
