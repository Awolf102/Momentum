import { addTask, type NewTask, type Task } from '@/features/tasks'
import type { DateKey } from '@/lib/date'
import { createId } from '@/lib/id'
import {
  goals,
  MAX_GOAL_TITLE,
  MAX_LINKS,
  MAX_MILESTONE_TITLE,
  MAX_MILESTONES,
  MAX_WHY,
  sortGoals,
} from './goals'
import type { Goal, Milestone } from './types'

export interface NewGoal {
  title: string
  why?: string
  subjectId?: string | null
  target?: DateKey | null
  /** Milestone titles, in order. */
  milestones?: readonly string[]
}

const activeGoals = () => goals.get().filter((goal) => goal.status === 'active')

/** Adds a goal at the end of the active ones. */
export async function addGoal(
  fields: NewGoal,
  now: Date = new Date(),
): Promise<Goal | null> {
  const title = fields.title.trim().slice(0, MAX_GOAL_TITLE)
  if (!title) return null
  const stamp = now.toISOString()
  const active = activeGoals()
  const goal: Goal = {
    id: createId(),
    title,
    why: (fields.why ?? '').trim().slice(0, MAX_WHY),
    subjectId: fields.subjectId ?? null,
    target: fields.target ?? null,
    milestones: (fields.milestones ?? [])
      .map((each) => each.trim().slice(0, MAX_MILESTONE_TITLE))
      .filter(Boolean)
      .slice(0, MAX_MILESTONES)
      .map((each) => ({
        id: createId(),
        title: each,
        due: null,
        doneAt: null,
      })),
    taskIds: [],
    habitIds: [],
    status: 'active',
    closedAt: null,
    order: active.length
      ? Math.max(...active.map((each) => each.order)) + 1
      : 0,
    createdAt: stamp,
    updatedAt: stamp,
    deletedAt: null,
  }
  await goals.add(goal)
  return goal
}

/** Applies `change` to a live goal and saves it. */
async function change(
  id: string,
  now: Date,
  apply: (goal: Goal) => Goal | null,
): Promise<Goal | null> {
  const goal = goals.find(id)
  if (!goal || goal.deletedAt) return null
  const next = apply(goal)
  if (!next) return null
  const saved = { ...next, updatedAt: now.toISOString() }
  await goals.put(saved)
  return saved
}

export type GoalChanges = Partial<
  Pick<Goal, 'title' | 'why' | 'subjectId' | 'target'>
>

export async function updateGoal(
  id: string,
  changes: GoalChanges,
  now: Date = new Date(),
): Promise<void> {
  await change(id, now, (goal) => ({
    ...goal,
    ...changes,
    title:
      (changes.title ?? goal.title).trim().slice(0, MAX_GOAL_TITLE) ||
      goal.title,
    why: (changes.why ?? goal.why).trim().slice(0, MAX_WHY),
  }))
}

/** Adds a milestone at the end. Null if the title is empty or there are too many. */
export async function addMilestone(
  goalId: string,
  title: string,
  due: DateKey | null = null,
  now: Date = new Date(),
): Promise<Milestone | null> {
  const clean = title.trim().slice(0, MAX_MILESTONE_TITLE)
  if (!clean) return null
  const milestone: Milestone = {
    id: createId(),
    title: clean,
    due,
    doneAt: null,
  }
  const saved = await change(goalId, now, (goal) =>
    goal.milestones.length >= MAX_MILESTONES
      ? null
      : { ...goal, milestones: [...goal.milestones, milestone] },
  )
  return saved ? milestone : null
}

export async function updateMilestone(
  goalId: string,
  milestoneId: string,
  changes: Partial<Pick<Milestone, 'title' | 'due'>>,
  now: Date = new Date(),
): Promise<void> {
  await change(goalId, now, (goal) => ({
    ...goal,
    milestones: goal.milestones.map((milestone) =>
      milestone.id === milestoneId
        ? {
            ...milestone,
            ...changes,
            title:
              (changes.title ?? milestone.title)
                .trim()
                .slice(0, MAX_MILESTONE_TITLE) || milestone.title,
          }
        : milestone,
    ),
  }))
}

/** Ticks a milestone off, or back on. Returns whether it's done now. */
export async function toggleMilestone(
  goalId: string,
  milestoneId: string,
  now: Date = new Date(),
): Promise<boolean> {
  let done = false
  await change(goalId, now, (goal) => ({
    ...goal,
    milestones: goal.milestones.map((milestone) => {
      if (milestone.id !== milestoneId) return milestone
      done = !milestone.doneAt
      return { ...milestone, doneAt: done ? now.toISOString() : null }
    }),
  }))
  return done
}

/** Takes a milestone off. Returns it and where it was, for Undo. */
export async function removeMilestone(
  goalId: string,
  milestoneId: string,
  now: Date = new Date(),
): Promise<{ milestone: Milestone; index: number } | null> {
  const index =
    goals
      .find(goalId)
      ?.milestones.findIndex((each) => each.id === milestoneId) ?? -1
  if (index < 0) return null
  const milestone = goals.find(goalId)!.milestones[index]
  await change(goalId, now, (goal) => ({
    ...goal,
    milestones: goal.milestones.filter((each) => each.id !== milestoneId),
  }))
  return { milestone, index }
}

/** Undo for `removeMilestone`: puts it back where it was. */
export async function restoreMilestone(
  goalId: string,
  milestone: Milestone,
  index: number,
  now: Date = new Date(),
): Promise<void> {
  await change(goalId, now, (goal) => {
    if (goal.milestones.some((each) => each.id === milestone.id)) return null
    const milestones = [...goal.milestones]
    milestones.splice(Math.min(index, milestones.length), 0, milestone)
    return { ...goal, milestones }
  })
}

/** Moves a milestone up (-1) or down (1) the list. */
export async function moveMilestone(
  goalId: string,
  milestoneId: string,
  offset: -1 | 1,
  now: Date = new Date(),
): Promise<void> {
  await change(goalId, now, (goal) => {
    const from = goal.milestones.findIndex((each) => each.id === milestoneId)
    const to = from + offset
    if (from < 0 || to < 0 || to >= goal.milestones.length) return null
    const milestones = [...goal.milestones]
    ;[milestones[from], milestones[to]] = [milestones[to], milestones[from]]
    return { ...goal, milestones }
  })
}

/** Links a task (by its series, so a repeating one stays linked) as a step. */
export async function linkTask(
  goalId: string,
  seriesId: string,
  now: Date = new Date(),
): Promise<void> {
  await change(goalId, now, (goal) =>
    goal.taskIds.includes(seriesId) || goal.taskIds.length >= MAX_LINKS
      ? null
      : { ...goal, taskIds: [...goal.taskIds, seriesId] },
  )
}

export async function unlinkTask(
  goalId: string,
  seriesId: string,
  now: Date = new Date(),
): Promise<void> {
  await change(goalId, now, (goal) =>
    goal.taskIds.includes(seriesId)
      ? { ...goal, taskIds: goal.taskIds.filter((id) => id !== seriesId) }
      : null,
  )
}

/** Adds a task and links it; it takes the goal's subject unless it has its own. */
export async function addTaskToGoal(
  goalId: string,
  input: NewTask,
  now: Date = new Date(),
): Promise<Task | null> {
  const goal = goals.find(goalId)
  if (!goal || goal.deletedAt || goal.taskIds.length >= MAX_LINKS) return null
  const task = await addTask(
    { ...input, subjectId: input.subjectId ?? goal.subjectId },
    now,
  )
  if (task) await linkTask(goalId, task.seriesId, now)
  return task
}

export async function linkHabit(
  goalId: string,
  habitId: string,
  now: Date = new Date(),
): Promise<void> {
  await change(goalId, now, (goal) =>
    goal.habitIds.includes(habitId) || goal.habitIds.length >= MAX_LINKS
      ? null
      : { ...goal, habitIds: [...goal.habitIds, habitId] },
  )
}

export async function unlinkHabit(
  goalId: string,
  habitId: string,
  now: Date = new Date(),
): Promise<void> {
  await change(goalId, now, (goal) =>
    goal.habitIds.includes(habitId)
      ? { ...goal, habitIds: goal.habitIds.filter((id) => id !== habitId) }
      : null,
  )
}

/** Marks a goal reached. */
export async function achieveGoal(
  id: string,
  now: Date = new Date(),
): Promise<void> {
  await change(id, now, (goal) =>
    goal.status === 'achieved'
      ? null
      : { ...goal, status: 'achieved', closedAt: now.toISOString() },
  )
}

/** Puts a goal away without reaching it. */
export async function archiveGoal(
  id: string,
  now: Date = new Date(),
): Promise<void> {
  await change(id, now, (goal) =>
    goal.status === 'archived'
      ? null
      : { ...goal, status: 'archived', closedAt: now.toISOString() },
  )
}

/** Back to working on it, at the end of the active goals. */
export async function reopenGoal(
  id: string,
  now: Date = new Date(),
): Promise<void> {
  const active = activeGoals()
  await change(id, now, (goal) =>
    goal.status === 'active'
      ? null
      : {
          ...goal,
          status: 'active',
          closedAt: null,
          order: active.length
            ? Math.max(...active.map((each) => each.order)) + 1
            : 0,
        },
  )
}

/**
 * Undo for reaching, putting away or reopening a goal: its status, when it
 * closed and its place go back to what they were.
 */
export async function revertGoal(
  previous: Goal,
  now: Date = new Date(),
): Promise<void> {
  await change(previous.id, now, (goal) => ({
    ...goal,
    status: previous.status,
    closedAt: previous.closedAt,
    order: previous.order,
  }))
}

/** Moves an active goal up (-1) or down (1) the list. */
export async function moveGoal(
  id: string,
  offset: -1 | 1,
  now: Date = new Date(),
): Promise<void> {
  const active = sortGoals(activeGoals())
  const from = active.findIndex((goal) => goal.id === id)
  const to = from + offset
  if (from < 0 || to < 0 || to >= active.length) return
  // Swapping orders keeps every other goal where it is.
  const [a, b] = [active[from], active[to]]
  const [orderA, orderB] =
    a.order === b.order ? [b.order + offset, a.order] : [b.order, a.order]
  const stamp = now.toISOString()
  await goals.put({ ...a, order: orderA, updatedAt: stamp })
  await goals.put({ ...b, order: orderB, updatedAt: stamp })
}

export async function deleteGoal(id: string, now?: Date): Promise<void> {
  await goals.remove(id, now)
}

/** Undo for `deleteGoal`. */
export async function restoreGoal(
  id: string,
  now: Date = new Date(),
): Promise<void> {
  const goal = goals.find(id)
  if (!goal?.deletedAt) return
  await goals.put({ ...goal, deletedAt: null, updatedAt: now.toISOString() })
}
