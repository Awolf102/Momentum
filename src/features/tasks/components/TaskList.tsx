import { AnimatePresence } from 'motion/react'
import { useState } from 'react'
import { GlassCard } from '@/components/GlassCard'
import { cn } from '@/lib/cn'
import type { DateKey } from '@/lib/date'
import { groupTasks } from '../lib/groups'
import type { Task } from '../types'
import { TaskRow } from './TaskRow'

const DONE_SHOWN = 10

/** Tasks by when they're due; finished ones folded away at the end. */
export function TaskList({
  tasks,
  today,
}: {
  tasks: readonly Task[]
  today: DateKey
}) {
  const [showDone, setShowDone] = useState(false)
  const [doneLimit, setDoneLimit] = useState(DONE_SHOWN)
  const groups = groupTasks(tasks, today)
  if (groups.length === 0) {
    return (
      <GlassCard className="px-5 py-6 text-center text-sm leading-relaxed text-fg-muted sm:px-6">
        Nothing on your list. Add a task above — dates, #subjects, priorities
        and repeats are understood as you type.
      </GlassCard>
    )
  }
  return (
    <div className="flex flex-col gap-4">
      {groups.map((group) => {
        const isDone = group.id === 'done'
        const shown = isDone ? group.tasks.slice(0, doneLimit) : group.tasks
        return (
          <GlassCard key={group.id} className="px-5 py-4 sm:px-6">
            <h2
              className={cn(
                'flex items-center justify-between pt-1 text-xs font-semibold tracking-[0.2em] uppercase',
                group.id === 'overdue'
                  ? 'text-rose-300 light:text-rose-600'
                  : 'text-fg-muted',
              )}
            >
              <span>
                {group.label}
                <span className="ml-2 font-medium tracking-normal text-fg-subtle tabular-nums">
                  {group.tasks.length}
                </span>
              </span>
              {isDone && (
                <button
                  type="button"
                  onClick={() => setShowDone((value) => !value)}
                  aria-expanded={showDone}
                  className="rounded-full px-2.5 py-1 text-xs font-semibold tracking-normal normal-case transition hover:bg-tint"
                >
                  {showDone ? 'Hide' : 'Show'}
                </button>
              )}
            </h2>
            {(!isDone || showDone) && (
              <ul className="mt-1 divide-y divide-line">
                <AnimatePresence initial={false}>
                  {shown.map((task) => (
                    <TaskRow key={task.id} task={task} today={today} />
                  ))}
                </AnimatePresence>
              </ul>
            )}
            {isDone && showDone && group.tasks.length > doneLimit && (
              <button
                type="button"
                onClick={() => setDoneLimit((limit) => limit + DONE_SHOWN * 3)}
                className="mt-2 rounded-full px-3 py-1.5 text-xs font-semibold text-fg-muted transition hover:bg-tint"
              >
                Show more
              </button>
            )}
          </GlassCard>
        )
      })}
    </div>
  )
}
