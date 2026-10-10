import { addDays, type DateKey } from '@/lib/date'
import type { Task } from '../types'

export type GroupId =
  'overdue' | 'today' | 'tomorrow' | 'upcoming' | 'someday' | 'done'

export interface TaskGroup {
  id: GroupId
  label: string
  tasks: Task[]
}

/** Due first (earliest date, then time), then higher priority, then oldest. */
export function compareTasks(a: Task, b: Task): number {
  if (a.due !== b.due) {
    if (a.due === null) return 1
    if (b.due === null) return -1
    return a.due < b.due ? -1 : 1
  }
  if (a.time !== b.time) {
    if (a.time === null) return 1
    if (b.time === null) return -1
    return a.time < b.time ? -1 : 1
  }
  return (
    b.priority - a.priority ||
    (a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0)
  )
}

/** The list view: overdue, today, tomorrow, later, no date, then done. */
export function groupTasks(
  tasks: readonly Task[],
  today: DateKey,
): TaskGroup[] {
  const tomorrow = addDays(today, 1)
  const groups: Record<GroupId, TaskGroup> = {
    overdue: { id: 'overdue', label: 'Overdue', tasks: [] },
    today: { id: 'today', label: 'Today', tasks: [] },
    tomorrow: { id: 'tomorrow', label: 'Tomorrow', tasks: [] },
    upcoming: { id: 'upcoming', label: 'Later', tasks: [] },
    someday: { id: 'someday', label: 'No date', tasks: [] },
    done: { id: 'done', label: 'Done', tasks: [] },
  }
  for (const task of tasks) {
    const group =
      task.status === 'done'
        ? 'done'
        : task.due === null
          ? 'someday'
          : task.due < today
            ? 'overdue'
            : task.due === today
              ? 'today'
              : task.due === tomorrow
                ? 'tomorrow'
                : 'upcoming'
    groups[group].tasks.push(task)
  }
  for (const group of Object.values(groups)) {
    if (group.id === 'done') {
      // Most recently finished first.
      group.tasks.sort((a, b) =>
        (a.completedAt ?? '') < (b.completedAt ?? '') ? 1 : -1,
      )
    } else group.tasks.sort(compareTasks)
  }
  return Object.values(groups).filter((group) => group.tasks.length > 0)
}

/** Overdue and due today: what the dashboard shows. */
export function dueBy(tasks: readonly Task[], today: DateKey): Task[] {
  return tasks
    .filter(
      (task) =>
        task.status !== 'done' && task.due !== null && task.due <= today,
    )
    .sort(compareTasks)
}

/** Tasks finished per day (local days), for the calendar. */
export function completedByDay(
  tasks: readonly Task[],
  toDay: (iso: string) => DateKey,
): Map<DateKey, number> {
  const counts = new Map<DateKey, number>()
  for (const task of tasks) {
    if (task.status !== 'done' || !task.completedAt) continue
    const day = toDay(task.completedAt)
    counts.set(day, (counts.get(day) ?? 0) + 1)
  }
  return counts
}
