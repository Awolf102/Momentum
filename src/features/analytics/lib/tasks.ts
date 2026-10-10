import { localDay, type DateKey } from '@/lib/date'
import { bucketIndex, type Bucket } from './period'

/** What the task charts need of a task. */
export interface TaskLike {
  status: string
  due: DateKey | null
  completedAt: string | null
  deletedAt?: string | null
}

/** Tasks that were due: finished by their day, finished after it, or not. */
export interface Completion {
  due: number
  onTime: number
  late: number
  open: number
}

const EMPTY: Completion = { due: 0, onTime: 0, late: 0, open: 0 }

/**
 * How a dated task did. Tasks due today count once they're done (until
 * then they aren't late), and later ones not at all.
 */
function outcome(
  task: TaskLike,
  today: DateKey,
): 'onTime' | 'late' | 'open' | null {
  if (task.deletedAt || task.due === null || task.due > today) return null
  if (task.status === 'done') {
    // Done without a time (older data): give it the benefit of the doubt.
    if (!task.completedAt) return 'onTime'
    return localDay(task.completedAt) <= task.due ? 'onTime' : 'late'
  }
  return task.due < today ? 'open' : null
}

const add = (total: Completion, result: 'onTime' | 'late' | 'open') => {
  total.due++
  total[result]++
}

/** Tasks due from `from` to `to` (up to today), and how they did. */
export function completionBetween(
  tasks: readonly TaskLike[],
  from: DateKey,
  to: DateKey,
  today: DateKey,
): Completion {
  const total = { ...EMPTY }
  for (const task of tasks) {
    if (task.due === null || task.due < from || task.due > to) continue
    const result = outcome(task, today)
    if (result) add(total, result)
  }
  return total
}

/** The same, for each column, by the day each task was due. */
export function completionByBucket(
  tasks: readonly TaskLike[],
  buckets: readonly Bucket[],
  today: DateKey,
): Completion[] {
  const totals = buckets.map(() => ({ ...EMPTY }))
  for (const task of tasks) {
    if (task.due === null) continue
    const index = bucketIndex(buckets, task.due)
    if (index < 0) continue
    const result = outcome(task, today)
    if (result) add(totals[index], result)
  }
  return totals
}

/** Done, of those due (null with none due). */
export const completionRate = (total: Completion) =>
  total.due ? (total.onTime + total.late) / total.due : null

/** Tasks finished in each column, dated or not, by the day they were done. */
export function finishedByBucket(
  tasks: readonly TaskLike[],
  buckets: readonly Bucket[],
): number[] {
  const counts = buckets.map(() => 0)
  for (const task of tasks) {
    if (task.deletedAt || task.status !== 'done' || !task.completedAt) continue
    const index = bucketIndex(buckets, localDay(task.completedAt))
    if (index >= 0) counts[index]++
  }
  return counts
}
