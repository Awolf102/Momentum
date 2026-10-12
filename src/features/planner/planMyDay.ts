import {
  ai,
  formatSource,
  type ReplyPhase,
  type RetryInfo,
} from '@/features/ai'
import { focusSettingsStore } from '@/features/focus'
import { goals, sortGoals } from '@/features/goals/data'
import {
  habitCheckIns,
  habitsStore,
  isScheduled,
  liveHabits,
} from '@/features/habits'
import { liveSubjects, subjectsStore } from '@/features/subjects'
import { tasks, type Task } from '@/features/tasks'
import { addDays, type DateKey } from '@/lib/date'
import { createId } from '@/lib/id'
import { createStore } from '@/lib/store'
import { addBlock, removeBlock } from './actions'
import { blocks } from './blocks'
import { calendars } from './calendars'
import { eventsOnDay } from './lib/day'
import {
  MAX_PLAN_TASKS,
  PLAN_SYSTEM,
  planRequest,
  readPlan,
  type DraftBlock,
  type PlanContext,
  type PlanDraft,
} from './lib/draft'
import type { Block } from './types'

/** What can be shared to plan a day; each can be left out. */
export type PlanPart = 'events' | 'blocks' | 'tasks' | 'goals' | 'habits'
export const PLAN_PARTS: readonly PlanPart[] = [
  'events',
  'blocks',
  'tasks',
  'goals',
  'habits',
]

/** Tasks due this far ahead are offered to the plan, as well as overdue and undated ones. */
const AHEAD_DAYS = 14
/** Room for the reply: twenty blocks with their reasons. */
const PLAN_REPLY_TOKENS = 2000

const overlaps = (start: number, end: number, from: number, until: number) =>
  start < until && from < end

/**
 * What the model sees to plan `day` between `from` and `until`, from what's
 * on this device. Parts left out send nothing of their own; the times of
 * events and blocks always go (without titles), so nothing is planned over
 * them.
 */
export function gatherPlanContext(
  day: DateKey,
  window: { from: number; until: number },
  now: number | null,
  parts: ReadonlySet<PlanPart>,
): PlanContext {
  const { from, until } = window
  const subjects = liveSubjects(subjectsStore.get())
  const subjectName = (id: string | null) =>
    (id && subjects.find((subject) => subject.id === id)?.name) || ''
  const allTasks = tasks.get()
  const taskById = new Map(allTasks.map((task) => [task.id, task]))

  const dayBlocks = blocks.get().filter((block) => block.day === day)
  const blockTitle = (block: Block) =>
    (block.taskId ? taskById.get(block.taskId)?.title : null) ||
    block.title ||
    (block.kind === 'focus'
      ? `Focus${block.subjectId ? `: ${subjectName(block.subjectId)}` : ''}`
      : 'Busy')
  const busy: PlanContext['busy'] = [
    ...eventsOnDay(calendars.get(), day)
      .filter(
        (event) =>
          !event.allDay && overlaps(event.start, event.end, from, until),
      )
      .map((event) => ({
        start: event.start,
        end: event.end,
        title: parts.has('events') ? event.title || 'Busy' : null,
        kind: 'event' as const,
      })),
    ...dayBlocks
      .filter((block) => overlaps(block.start, block.end, from, until))
      .map((block) => ({
        start: block.start,
        end: block.end,
        title: parts.has('blocks') ? blockTitle(block) : null,
        kind: 'block' as const,
      })),
  ]

  const active = sortGoals(goals.get()).filter(
    (goal) => goal.status === 'active',
  )
  const goalOf = new Map<string, string>()
  for (const goal of active)
    for (const seriesId of goal.taskIds)
      if (!goalOf.has(seriesId)) goalOf.set(seriesId, goal.title)

  const onPlan = new Set(dayBlocks.map((block) => block.taskId))
  const horizon = addDays(day, AHEAD_DAYS)
  const rank = (task: Task) =>
    task.due === null ? 3 : task.due < day ? 0 : task.due === day ? 1 : 2
  const planTasks = parts.has('tasks')
    ? allTasks
        .filter(
          (task) =>
            task.status !== 'done' &&
            !onPlan.has(task.id) &&
            (task.due === null || task.due <= horizon),
        )
        .sort(
          (a, b) =>
            rank(a) - rank(b) ||
            (a.due ?? '').localeCompare(b.due ?? '') ||
            (a.time ?? '99').localeCompare(b.time ?? '99') ||
            b.priority - a.priority ||
            a.order - b.order,
        )
        .slice(0, MAX_PLAN_TASKS)
        .map((task) => ({
          id: task.id,
          title: task.title,
          due: task.due,
          time: task.time,
          priority: task.priority,
          subjectId: task.subjectId,
          subject: subjectName(task.subjectId),
          goal: parts.has('goals') ? (goalOf.get(task.seriesId) ?? null) : null,
        }))
    : []

  const doneThatDay = new Set(
    habitCheckIns
      .get()
      .filter((record) => record.day === day)
      .map((record) => record.habitId),
  )

  return {
    day,
    now,
    from,
    until,
    focusMinutes: focusSettingsStore.get().focusMinutes,
    busy,
    tasks: planTasks,
    goals: parts.has('goals')
      ? active.map((goal) => {
          const next = goal.milestones.find((milestone) => !milestone.doneAt)
          return {
            title: goal.title,
            target: goal.target,
            next: next?.title ?? null,
            nextDue: next?.due ?? null,
          }
        })
      : [],
    habits: parts.has('habits')
      ? liveHabits(habitsStore.get())
          .filter(
            (habit) =>
              isScheduled(day, habit.weekdays) && !doneThatDay.has(habit.id),
          )
          .map((habit) => habit.name)
      : [],
    subjects: subjects.map(({ id, name }) => ({ id, name })),
  }
}

/** Asks the chat model to draft the day. Nothing else is sent. */
export async function draftPlan(
  context: PlanContext,
  options: {
    signal?: AbortSignal
    onRetry?: (info: RetryInfo) => void
    onProgress?: (phase: ReplyPhase) => void
  } = {},
): Promise<PlanDraft> {
  const { text, stopReason, source } = await ai.complete({
    system: PLAN_SYSTEM,
    messages: [{ role: 'user', content: planRequest(context) }],
    maxTokens: PLAN_REPLY_TOKENS,
    feature: 'planning',
    signal: options.signal,
    onRetry: options.onRetry,
    onProgress: options.onProgress,
  })
  const draft = readPlan(text, context, {
    cutOff: stopReason === 'max-tokens',
  })
  return source ? { ...draft, madeBy: formatSource(source) } : draft
}

/** A draft being looked over, for one day, with the blocks to keep. */
export interface DraftOnPlan {
  /** Each draft's own, so a new one can be told from a change to this one. */
  id: string
  day: DateKey
  blocks: Array<DraftBlock & { keep: boolean }>
  note: string
  dropped: number
  /** The reply was cut off at the length limit. */
  cutOff?: boolean
  /** Who drafted it. */
  madeBy?: string
}

/** The draft on the plan (one at a time), until it's added or put aside. */
export const planDraftStore = createStore<DraftOnPlan | null>(null)

export function showDraft(day: DateKey, draft: PlanDraft): void {
  planDraftStore.set({
    id: createId(),
    day,
    blocks: draft.blocks.map((block) => ({ ...block, keep: true })),
    note: draft.note,
    dropped: draft.dropped,
    cutOff: draft.cutOff,
    madeBy: draft.madeBy,
  })
}

export function changeDraft(
  key: string,
  change: Partial<Pick<DraftBlock, 'start' | 'end' | 'title'>> & {
    keep?: boolean
  },
): void {
  planDraftStore.set((current) =>
    current
      ? {
          ...current,
          blocks: current.blocks.map((block) =>
            block.key === key ? { ...block, ...change } : block,
          ),
        }
      : current,
  )
}

export const clearDraft = () => planDraftStore.set(null)

/** Puts the kept blocks on the plan. Returns them, for Undo. */
export async function addDraft(now: Date = new Date()): Promise<Block[]> {
  const draft = planDraftStore.get()
  if (!draft) return []
  const added: Block[] = []
  for (const block of draft.blocks.filter((each) => each.keep)) {
    added.push(
      await addBlock(
        {
          day: draft.day,
          start: block.start,
          end: block.end,
          kind: block.kind,
          title: block.title,
          taskId: block.taskId,
          subjectId: block.subjectId,
        },
        now,
      ),
    )
  }
  clearDraft()
  return added
}

/** Undo for `addDraft`. */
export async function removeAdded(added: readonly Block[]): Promise<void> {
  for (const block of added) await removeBlock(block.id)
}
