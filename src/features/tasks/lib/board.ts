import type { Task, TaskStatus } from '../types'

export const COLUMNS: readonly { status: TaskStatus; label: string }[] = [
  { status: 'todo', label: 'To do' },
  { status: 'doing', label: 'Doing' },
  { status: 'done', label: 'Done' },
]

const byOrder = (a: Task, b: Task) =>
  a.order - b.order || (a.createdAt < b.createdAt ? -1 : 1)

/** Most recently finished first. */
const byCompletion = (a: Task, b: Task) =>
  (a.completedAt ?? '') < (b.completedAt ?? '') ? 1 : -1

/**
 * The board's columns. To do and Doing keep the order you arrange; Done is
 * newest first, whichever device a task was finished on.
 */
export function boardColumns(
  tasks: readonly Task[],
): Record<TaskStatus, Task[]> {
  const columns: Record<TaskStatus, Task[]> = { todo: [], doing: [], done: [] }
  for (const task of tasks) columns[task.status].push(task)
  columns.todo.sort(byOrder)
  columns.doing.sort(byOrder)
  columns.done.sort(byCompletion)
  return columns
}

/**
 * The order value that puts a card just before `beforeId` in a column (or at
 * the end without one). Orders are numbers with room between them, so a move
 * changes one card, not the whole column.
 */
export function orderFor(
  column: readonly Task[],
  movingId: string,
  beforeId: string | null,
): number {
  const others = column.filter((task) => task.id !== movingId)
  const index =
    beforeId === null
      ? others.length
      : Math.max(
          0,
          others.findIndex((task) => task.id === beforeId),
        )
  const before = others[index - 1]?.order
  const after = others[index]?.order
  if (before === undefined && after === undefined) return 0
  if (before === undefined) return after! - 1
  if (after === undefined) return before + 1
  return (before + after) / 2
}

/** The top of a column (new "done" cards go first). */
export const topOrder = (column: readonly Task[]) =>
  column.length ? Math.min(...column.map((task) => task.order)) - 1 : 0

/** The end of a column (new cards go last). */
export const endOrder = (column: readonly Task[]) =>
  column.length ? Math.max(...column.map((task) => task.order)) + 1 : 0
