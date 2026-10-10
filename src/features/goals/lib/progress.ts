import type { Task } from '@/features/tasks'
import { daysBetween, toDateKey, type DateKey } from '@/lib/date'
import type { Goal, Milestone } from '../types'

/**
 * A task linked to a goal. Links are by series, so a repeating task stays
 * linked as it moves on: it shows its next time and how often it's been
 * done, like a habit, and isn't a step (it never finishes). A one-off task
 * is a step, done when it's ticked off.
 */
export type LinkedTask =
  | { kind: 'step'; seriesId: string; task: Task; done: boolean }
  | { kind: 'repeating'; seriesId: string; task: Task; timesDone: number }

/**
 * The live tasks of each linked series: its open occurrence if it has one,
 * otherwise the last one done. A series with no live task (deleted) is left
 * out, and comes back if the task is restored.
 */
export function linkedTasks(
  seriesIds: readonly string[],
  allTasks: readonly Task[],
): LinkedTask[] {
  const bySeries = new Map<string, Task[]>()
  for (const task of allTasks) {
    if (task.deletedAt) continue
    const list = bySeries.get(task.seriesId)
    if (list) list.push(task)
    else bySeries.set(task.seriesId, [task])
  }
  const linked: LinkedTask[] = []
  for (const seriesId of seriesIds) {
    const series = bySeries.get(seriesId)
    if (!series) continue
    const open = series.find((task) => task.status !== 'done')
    const task =
      open ??
      series.reduce((last, each) =>
        (each.completedAt ?? '') > (last.completedAt ?? '') ? each : last,
      )
    linked.push(
      task.recurrence
        ? {
            kind: 'repeating',
            seriesId,
            task,
            timesDone: series.filter((each) => each.status === 'done').length,
          }
        : { kind: 'step', seriesId, task, done: task.status === 'done' },
    )
  }
  return linked
}

/** How a goal is going against its target date. */
export type Pace = 'ahead' | 'on-track' | 'behind'

export interface GoalProgress {
  /** Milestones and one-off tasks. */
  steps: number
  done: number
  /** Share of the steps done, 0–1, or null with no steps yet. */
  share: number | null
  /** The first milestone not done yet, in the goal's order. */
  next: Milestone | null
  /** Milestones past their day and not done. */
  overdue: number
  /** Days until the target (negative once it's passed), or null without one. */
  daysLeft: number | null
  /**
   * Steps done against the time gone between starting and the target, or
   * null without a target or steps. Past the target and not reached is
   * behind.
   */
  pace: Pace | null
  /** Share of time gone from starting to the target, 0–1. */
  elapsed: number | null
  /** The linked habits' share of scheduled days done in the last four weeks, on average. */
  habitRate: number | null
}

/** How far ahead of or behind the time gone counts as ahead or behind. */
export const PACE_MARGIN = 0.1

export function goalProgress(
  goal: Goal,
  linked: readonly LinkedTask[],
  /** The linked habits' four-week rates (null for a habit with no days yet). */
  habitRates: readonly (number | null)[],
  today: DateKey,
): GoalProgress {
  const steps = linked.filter((each) => each.kind === 'step')
  const total = goal.milestones.length + steps.length
  const done =
    goal.milestones.filter((milestone) => milestone.doneAt).length +
    steps.filter((each) => each.done).length
  const share = total ? done / total : null
  const next = goal.milestones.find((milestone) => !milestone.doneAt) ?? null
  const overdue = goal.milestones.filter(
    (milestone) => !milestone.doneAt && milestone.due && milestone.due < today,
  ).length
  const started = toDateKey(new Date(goal.createdAt))
  let elapsed: number | null = null
  let pace: Pace | null = null
  if (goal.target) {
    const span = daysBetween(started, goal.target)
    elapsed =
      span <= 0
        ? 1
        : Math.min(1, Math.max(0, daysBetween(started, today) / span))
    if (share !== null) {
      pace =
        share >= 1
          ? 'ahead'
          : today > goal.target
            ? 'behind'
            : share >= elapsed + PACE_MARGIN
              ? 'ahead'
              : share >= elapsed - PACE_MARGIN
                ? 'on-track'
                : 'behind'
    }
  }
  const rates = habitRates.filter((rate): rate is number => rate !== null)
  return {
    steps: total,
    done,
    share,
    next,
    overdue,
    daysLeft: goal.target ? daysBetween(today, goal.target) : null,
    pace,
    elapsed,
    habitRate: rates.length
      ? rates.reduce((sum, rate) => sum + rate, 0) / rates.length
      : null,
  }
}
