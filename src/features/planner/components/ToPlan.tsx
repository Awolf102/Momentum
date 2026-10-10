import type { PointerEvent as ReactPointerEvent } from 'react'
import { Link } from 'wouter'
import { GripIcon, PlusIcon } from '@/components/icons'
import { SubjectDot, subjectsStore } from '@/features/subjects'
import type { Task } from '@/features/tasks'
import { cn } from '@/lib/cn'
import { formatDateKey, type DateKey } from '@/lib/date'
import { paths } from '@/lib/routes'
import { useStore } from '@/lib/store'
import { formatClock, parseClock } from '../lib/time'

const SHOWN = 40

function dueLabel(task: Task, day: DateKey): { text: string; late: boolean } {
  if (!task.due) return { text: 'No date', late: false }
  if (task.due < day)
    return {
      text: `Overdue · ${formatDateKey(task.due, { day: 'numeric', month: 'short' })}`,
      late: true,
    }
  const minutes = parseClock(task.time)
  return {
    text: minutes === null ? 'Due that day' : `Due ${formatClock(minutes)}`,
    late: false,
  }
}

/**
 * Tasks waiting for a time: overdue, due that day, or undated. Drag one onto
 * the day (with a mouse), or add it to the next free hour.
 */
export function ToPlan({
  tasks,
  day,
  onAdd,
  onDragStart,
}: {
  tasks: readonly Task[]
  day: DateKey
  onAdd: (task: Task) => void
  /** When given, tasks can be dragged onto the timeline. */
  onDragStart?: (task: Task, event: ReactPointerEvent<HTMLElement>) => void
}) {
  const { subjects } = useStore(subjectsStore)
  if (tasks.length === 0)
    return (
      <p className="text-sm text-fg-muted">
        Nothing waiting. Tasks due by then, and ones without a date, show here.
      </p>
    )
  return (
    <div>
      <ul aria-label="Tasks to plan" className="-mx-1 space-y-0.5">
        {tasks.slice(0, SHOWN).map((task) => {
          const subject = subjects.find((each) => each.id === task.subjectId)
          const due = dueLabel(task, day)
          return (
            <li
              key={task.id}
              onPointerDown={
                onDragStart
                  ? (event) => {
                      if (
                        event.button === 0 &&
                        event.pointerType === 'mouse' &&
                        !(event.target as HTMLElement).closest('button')
                      )
                        onDragStart(task, event)
                    }
                  : undefined
              }
              className={cn(
                'group flex items-center gap-2 rounded-xl px-1 py-1.5 transition hover:bg-tint',
                onDragStart && 'cursor-grab select-none',
              )}
            >
              {onDragStart && (
                <GripIcon
                  aria-hidden="true"
                  className="shrink-0 text-fg-subtle opacity-0 transition group-hover:opacity-100"
                />
              )}
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1.5 text-sm font-medium">
                  {subject && <SubjectDot color={subject.color} />}
                  <span className="truncate">{task.title}</span>
                </p>
                <p
                  className={cn(
                    'text-xs',
                    due.late
                      ? 'text-rose-300 light:text-rose-600'
                      : 'text-fg-subtle',
                  )}
                >
                  {due.text}
                </p>
              </div>
              <button
                type="button"
                onClick={() => onAdd(task)}
                aria-label={`Add “${task.title}” to the plan`}
                title="Add to the next free hour"
                className="grid size-8 shrink-0 place-items-center rounded-full text-fg-muted transition hover:bg-line hover:text-fg"
              >
                <PlusIcon />
              </button>
            </li>
          )
        })}
      </ul>
      {tasks.length > SHOWN && (
        <p className="mt-2 text-xs text-fg-subtle">
          And {tasks.length - SHOWN} more in{' '}
          <Link
            href={paths.tasks}
            className="font-semibold text-fg-muted underline-offset-2 hover:underline"
          >
            Tasks
          </Link>
          .
        </p>
      )}
    </div>
  )
}
