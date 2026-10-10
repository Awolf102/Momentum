import { createCollection } from '@/lib/collection'
import { isDateKey, toDateKey, type DateKey, type Weekday } from '@/lib/date'
import { isRecord } from '@/lib/guards'
import { createId } from '@/lib/id'
import { boardColumns, endOrder, orderFor, topOrder } from './lib/board'
import { nextDue } from './lib/recurrence'
import type {
  Priority,
  Recurrence,
  RecurrenceUnit,
  Task,
  TaskStatus,
} from './types'

const STATUSES: readonly TaskStatus[] = ['todo', 'doing', 'done']
const UNITS: readonly RecurrenceUnit[] = ['day', 'week', 'month', 'year']
export const MAX_TITLE_LENGTH = 300
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/

function parseRecurrence(value: unknown): Recurrence | null {
  if (!isRecord(value)) return null
  const { unit, interval, weekdays, anchor } = value
  if (!UNITS.includes(unit as RecurrenceUnit) || !isDateKey(anchor)) return null
  return {
    unit: unit as RecurrenceUnit,
    interval:
      typeof interval === 'number' && interval >= 1 && interval <= 365
        ? Math.floor(interval)
        : 1,
    weekdays: Array.isArray(weekdays)
      ? ([
          ...new Set(
            weekdays.filter(
              (day): day is Weekday =>
                Number.isInteger(day) && day >= 0 && day <= 6,
            ),
          ),
        ].sort() as Weekday[])
      : [],
    anchor,
  }
}

export function parseTask(value: unknown): Task | null {
  if (!isRecord(value)) return null
  const { id, title, createdAt, updatedAt } = value
  if (typeof id !== 'string' || typeof title !== 'string' || !title.trim())
    return null
  if (typeof createdAt !== 'string' || typeof updatedAt !== 'string')
    return null
  const due = isDateKey(value.due) ? value.due : null
  const status = STATUSES.includes(value.status as TaskStatus)
    ? (value.status as TaskStatus)
    : 'todo'
  return {
    id,
    title: title.trim().slice(0, MAX_TITLE_LENGTH),
    subjectId: typeof value.subjectId === 'string' ? value.subjectId : null,
    status,
    priority: [0, 1, 2, 3].includes(value.priority as number)
      ? (value.priority as Priority)
      : 0,
    due,
    time:
      due && typeof value.time === 'string' && TIME.test(value.time)
        ? value.time
        : null,
    recurrence: due ? parseRecurrence(value.recurrence) : null,
    seriesId: typeof value.seriesId === 'string' ? value.seriesId : id,
    completedAt:
      status === 'done' && typeof value.completedAt === 'string'
        ? value.completedAt
        : null,
    order:
      typeof value.order === 'number' && Number.isFinite(value.order)
        ? value.order
        : 0,
    createdAt,
    updatedAt,
    deletedAt: typeof value.deletedAt === 'string' ? value.deletedAt : null,
  }
}

/** Every task, one record each, in IndexedDB. */
export const tasks = createCollection<Task>({ name: 'tasks', parse: parseTask })

export interface NewTask {
  title: string
  due: DateKey | null
  time: string | null
  subjectId: string | null
  priority: Priority
  recurrence: Recurrence | null
}

const columnOf = (status: TaskStatus) => boardColumns(tasks.get())[status]

/** Adds a task at the end of "To do". */
export async function addTask(
  input: NewTask,
  now: Date = new Date(),
): Promise<Task | null> {
  const title = input.title.trim().slice(0, MAX_TITLE_LENGTH)
  if (!title) return null
  const id = createId()
  const stamp = now.toISOString()
  const task: Task = {
    id,
    title,
    subjectId: input.subjectId,
    status: 'todo',
    priority: input.priority,
    due: input.due,
    time: input.due ? input.time : null,
    recurrence: input.due ? input.recurrence : null,
    seriesId: id,
    completedAt: null,
    order: endOrder(columnOf('todo')),
    createdAt: stamp,
    updatedAt: stamp,
    deletedAt: null,
  }
  await tasks.add(task)
  return task
}

export type TaskChanges = Partial<
  Pick<Task, 'title' | 'subjectId' | 'priority' | 'due' | 'time' | 'recurrence'>
>

/**
 * Edits a task. Without a due date there's no time or repeat; moving the due
 * date of a repeating task moves its schedule with it.
 */
export async function updateTask(
  id: string,
  changes: TaskChanges,
  now: Date = new Date(),
): Promise<void> {
  const task = tasks.find(id)
  if (!task || task.deletedAt) return
  const next: Task = { ...task, ...changes, updatedAt: now.toISOString() }
  next.title = next.title.trim().slice(0, MAX_TITLE_LENGTH) || task.title
  if (!next.due) {
    next.time = null
    next.recurrence = null
  } else if (next.recurrence && changes.due && changes.due !== task.due) {
    next.recurrence = { ...next.recurrence, anchor: next.due }
  }
  await tasks.put(next)
}

/**
 * Finishes a task. A repeating one also creates its next occurrence, due on
 * the next date of its schedule after today. Returns that next task.
 */
export async function completeTask(
  id: string,
  now: Date = new Date(),
): Promise<Task | null> {
  const task = tasks.find(id)
  if (!task || task.deletedAt || task.status === 'done') return null
  const stamp = now.toISOString()
  await tasks.put({
    ...task,
    status: 'done',
    completedAt: stamp,
    order: topOrder(columnOf('done')),
    updatedAt: stamp,
  })
  if (!task.recurrence || !task.due) return null
  const due = nextDue(task.due, task.recurrence, toDateKey(now))
  const next: Task = {
    ...task,
    // The same id from every tab, so finishing it twice adds it once.
    id: `${task.seriesId}@${due}`,
    status: 'todo',
    due,
    completedAt: null,
    order: endOrder(columnOf('todo')),
    createdAt: stamp,
    updatedAt: stamp,
    deletedAt: null,
  }
  const added = await tasks.add(next)
  return added ? next : (tasks.find(next.id) ?? null)
}

/** Puts a finished task back on the list. */
export async function reopenTask(
  id: string,
  now: Date = new Date(),
): Promise<void> {
  const task = tasks.find(id)
  if (!task || task.deletedAt || task.status !== 'done') return
  await tasks.put({
    ...task,
    status: 'todo',
    completedAt: null,
    order: topOrder(columnOf('todo')),
    updatedAt: now.toISOString(),
  })
}

/**
 * Moves a card on the board: into `status`, just before `beforeId` (or at
 * the end). Moving into Done finishes it (with its next occurrence, if it
 * repeats); moving out of Done reopens it.
 */
export async function moveTask(
  id: string,
  status: TaskStatus,
  beforeId: string | null,
  now: Date = new Date(),
): Promise<void> {
  const task = tasks.find(id)
  if (!task || task.deletedAt) return
  if (status === 'done' && task.status !== 'done') {
    await completeTask(id, now)
  }
  const current = tasks.find(id)!
  const order = orderFor(columnOf(status), id, beforeId)
  await tasks.put({
    ...current,
    status,
    completedAt:
      status === 'done' ? (current.completedAt ?? now.toISOString()) : null,
    order,
    updatedAt: now.toISOString(),
  })
}

export async function deleteTask(id: string, now: Date = new Date()) {
  await tasks.remove(id, now)
}
