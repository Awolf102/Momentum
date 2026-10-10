import { useId, useMemo, useState } from 'react'
import { GlassCard } from '@/components/GlassCard'
import { CloseIcon, LinkIcon, RepeatIcon } from '@/components/icons'
import { Sheet } from '@/components/Sheet'
import {
  editTask,
  QuickAdd,
  TaskCheckbox,
  TaskMeta,
  tasks,
  type Task,
} from '@/features/tasks'
import { cn } from '@/lib/cn'
import { useStore } from '@/lib/store'
import { toast } from '@/lib/toast'
import { useToday } from '@/lib/useToday'
import { addTaskToGoal, linkTask, unlinkTask } from '../actions'
import { MAX_LINKS } from '../goals'
import type { LinkedTask } from '../lib/progress'
import type { Goal } from '../types'
import { plural, quiet, sectionTitle } from './ui'

/** Tasks towards a goal: one-off ones are steps; repeating ones keep count. */
export function GoalTasks({
  goal,
  linked,
}: {
  goal: Goal
  linked: readonly LinkedTask[]
}) {
  const headingId = useId()
  const [linking, setLinking] = useState(false)
  const steps = linked.filter((each) => each.kind === 'step')
  const done = steps.filter((each) => each.kind === 'step' && each.done).length
  const full = goal.taskIds.length >= MAX_LINKS

  return (
    <GlassCard aria-labelledby={headingId} className="p-5 sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <h2
          id={headingId}
          className={cn(sectionTitle, 'flex items-center gap-2')}
        >
          Tasks{' '}
          {steps.length > 0 && (
            <span className="font-medium tracking-normal normal-case tabular-nums">
              {done} of {steps.length} done
            </span>
          )}
        </h2>
        {!full && (
          <button
            type="button"
            onClick={() => setLinking(true)}
            className={quiet}
          >
            <LinkIcon /> Link a task
          </button>
        )}
      </div>
      {linked.length === 0 ? (
        <p className="mt-2 text-sm leading-relaxed text-fg-muted">
          Tasks here are steps towards the goal. Add one below, or link one you
          have. A repeating task keeps count of how often it’s done.
        </p>
      ) : (
        <ul className="mt-1 divide-y divide-line" aria-label="Linked tasks">
          {linked.map((each) => (
            <LinkedTaskRow key={each.seriesId} goal={goal} linked={each} />
          ))}
        </ul>
      )}
      {!full && (
        <QuickAdd
          add={(input) => addTaskToGoal(goal.id, input)}
          placeholder="Add a task towards it… e.g. Past paper fri"
          label="New task for this goal"
          className="mt-3"
        />
      )}
      <Sheet
        open={linking}
        onClose={() => setLinking(false)}
        title="Link a task"
      >
        {linking && <TaskPicker goal={goal} />}
      </Sheet>
    </GlassCard>
  )
}

function LinkedTaskRow({ goal, linked }: { goal: Goal; linked: LinkedTask }) {
  const today = useToday()
  const { task } = linked
  const done = task.status === 'done'
  return (
    <li className="flex items-start gap-3 py-2.5">
      <TaskCheckbox task={task} className="mt-0.5" />
      <button
        type="button"
        onClick={() => editTask(task.id)}
        className="min-w-0 flex-1 rounded-lg text-left"
      >
        <span
          className={cn(
            'block text-[15px] leading-snug break-words',
            done && 'text-fg-subtle line-through decoration-fg-subtle/50',
          )}
        >
          {task.title}
        </span>
        <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-fg-subtle">
          <TaskMeta task={task} today={today} />
          {linked.kind === 'repeating' && (
            <span className="inline-flex items-center gap-1">
              <RepeatIcon />
              {linked.timesDone
                ? `Done ${plural(linked.timesDone, 'time')}`
                : 'Not done yet'}
            </span>
          )}
        </span>
      </button>
      <button
        type="button"
        aria-label={`Unlink “${task.title}”`}
        title="Unlink from this goal (the task stays)"
        onClick={() => {
          void unlinkTask(goal.id, linked.seriesId)
          toast({
            id: `goal-unlink-${linked.seriesId}`,
            icon: <LinkIcon />,
            title: 'Unlinked from the goal',
            description: `${task.title} stays in your tasks.`,
            action: {
              label: 'Undo',
              run: () => void linkTask(goal.id, linked.seriesId),
            },
          })
        }}
        className="grid size-8 shrink-0 place-items-center rounded-full text-sm text-fg-subtle transition hover:bg-tint hover:text-fg"
      >
        <CloseIcon />
      </button>
    </li>
  )
}

/** Tasks you have, to link: open ones, or any that match a search. */
function TaskPicker({ goal }: { goal: Goal }) {
  const all = useStore(tasks)
  const today = useToday()
  const [query, setQuery] = useState('')
  const [lastLinked, setLastLinked] = useState<string | null>(null)

  // One row per task: a repeating one's open occurrence, or its latest.
  const series = useMemo(() => {
    const bySeries = new Map<string, Task>()
    for (const task of all) {
      const current = bySeries.get(task.seriesId)
      if (
        !current ||
        (current.status === 'done' && task.status !== 'done') ||
        (current.status === 'done' &&
          task.status === 'done' &&
          (task.completedAt ?? '') > (current.completedAt ?? ''))
      )
        bySeries.set(task.seriesId, task)
    }
    return [...bySeries.values()]
  }, [all])

  const needle = query.trim().toLowerCase()
  const shown = series
    .filter((task) => !goal.taskIds.includes(task.seriesId))
    .filter((task) =>
      needle
        ? task.title.toLowerCase().includes(needle)
        : task.status !== 'done',
    )
    .sort(
      (a, b) =>
        Number(a.status === 'done') - Number(b.status === 'done') ||
        (a.due ?? '9999').localeCompare(b.due ?? '9999') ||
        b.createdAt.localeCompare(a.createdAt),
    )
    .slice(0, 50)

  return (
    <div className="space-y-3 pt-1">
      <input
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Find a task"
        aria-label="Find a task"
        autoFocus
        className="h-11 w-full rounded-xl bg-tint px-3.5 text-[15px] outline-none focus-visible:outline-2"
      />
      {shown.length === 0 ? (
        <p className="text-sm text-fg-muted">
          {needle
            ? 'No tasks match that.'
            : 'There are no open tasks to link. Search to find ones that are done.'}
        </p>
      ) : (
        <ul className="divide-y divide-line" aria-label="Tasks to link">
          {shown.map((task) => (
            <li key={task.seriesId} className="flex items-center gap-3 py-2.5">
              <span className="min-w-0 flex-1">
                <span
                  className={cn(
                    'block text-[15px] leading-snug break-words',
                    task.status === 'done' && 'text-fg-subtle',
                  )}
                >
                  {task.title}
                </span>
                <TaskMeta task={task} today={today} className="mt-0.5" />
              </span>
              <button
                type="button"
                aria-label={`Link “${task.title}”`}
                onClick={() => {
                  void linkTask(goal.id, task.seriesId)
                  setLastLinked(task.title)
                }}
                className="shrink-0 rounded-full bg-tint px-3.5 py-1.5 text-xs font-semibold transition hover:bg-line"
              >
                Link
              </button>
            </li>
          ))}
        </ul>
      )}
      <p role="status" className="text-xs text-fg-subtle">
        {lastLinked
          ? `Linked “${lastLinked}”.`
          : !needle && 'Search to find tasks that are done, too.'}
      </p>
    </div>
  )
}
