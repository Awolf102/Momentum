import { createCollection } from '@/lib/collection'
import { isDateKey } from '@/lib/date'
import { isRecord } from '@/lib/guards'
import type { Goal, GoalStatus, Milestone } from './types'

export const MAX_GOAL_TITLE = 120
export const MAX_WHY = 2000
export const MAX_MILESTONE_TITLE = 200
export const MAX_MILESTONES = 50
export const MAX_LINKS = 100

const STATUSES: readonly GoalStatus[] = ['active', 'achieved', 'archived']

const ids = (value: unknown) =>
  Array.isArray(value)
    ? [
        ...new Set(
          value.filter((each): each is string => typeof each === 'string'),
        ),
      ].slice(0, MAX_LINKS)
    : []

function parseMilestone(value: unknown): Milestone | null {
  if (!isRecord(value) || typeof value.id !== 'string') return null
  const title =
    typeof value.title === 'string'
      ? value.title.trim().slice(0, MAX_MILESTONE_TITLE)
      : ''
  if (!title) return null
  return {
    id: value.id,
    title,
    due: isDateKey(value.due) ? value.due : null,
    doneAt: typeof value.doneAt === 'string' ? value.doneAt : null,
  }
}

/** A goal read back from storage or a backup. */
export function parseGoal(value: unknown): Goal | null {
  if (!isRecord(value)) return null
  const { id, createdAt, updatedAt } = value
  if (
    typeof id !== 'string' ||
    typeof createdAt !== 'string' ||
    typeof updatedAt !== 'string'
  )
    return null
  const title =
    typeof value.title === 'string'
      ? value.title.trim().slice(0, MAX_GOAL_TITLE)
      : ''
  if (!title) return null
  const status = STATUSES.includes(value.status as GoalStatus)
    ? (value.status as GoalStatus)
    : 'active'
  const seen = new Set<string>()
  return {
    id,
    title,
    why: typeof value.why === 'string' ? value.why.slice(0, MAX_WHY) : '',
    subjectId: typeof value.subjectId === 'string' ? value.subjectId : null,
    target: isDateKey(value.target) ? value.target : null,
    milestones: (Array.isArray(value.milestones) ? value.milestones : [])
      .map(parseMilestone)
      .filter((each): each is Milestone => {
        if (!each || seen.has(each.id)) return false
        seen.add(each.id)
        return true
      })
      .slice(0, MAX_MILESTONES),
    taskIds: ids(value.taskIds),
    habitIds: ids(value.habitIds),
    status,
    closedAt:
      status !== 'active' && typeof value.closedAt === 'string'
        ? value.closedAt
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

/** Goals, each with its milestones and links. */
export const goals = createCollection<Goal>({ name: 'goals', parse: parseGoal })

const compare = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0)

/** Active goals first, in their order; then reached and put away ones, latest first. */
export function sortGoals(list: readonly Goal[]): Goal[] {
  const rank = (goal: Goal) => (goal.status === 'active' ? 0 : 1)
  return [...list].sort(
    (a, b) =>
      rank(a) - rank(b) ||
      (a.status === 'active'
        ? a.order - b.order || compare(a.createdAt, b.createdAt)
        : compare(b.closedAt ?? '', a.closedAt ?? '')),
  )
}
