import { CalendarIcon, RepeatIcon } from '@/components/icons'
import { SUBJECT_COLORS, subjectsStore } from '@/features/subjects'
import { cn } from '@/lib/cn'
import type { DateKey } from '@/lib/date'
import { useStore } from '@/lib/store'
import { formatDue, formatTime, PRIORITY_NAMES } from '../lib/format'
import { describeRecurrence } from '../lib/recurrence'
import type { Task } from '../types'

export type TaskDetails = Pick<
  Task,
  'due' | 'time' | 'subjectId' | 'priority' | 'recurrence'
> & { status?: Task['status'] }

/** When it's due, whether it repeats, its subject and priority, in a line. */
export function TaskMeta({
  task,
  today,
  showPriority = false,
  className,
}: {
  task: TaskDetails
  today: DateKey
  /** Spell out the priority (the checkbox ring shows it otherwise). */
  showPriority?: boolean
  className?: string
}) {
  const { subjects } = useStore(subjectsStore)
  const subject = subjects.find((item) => item.id === task.subjectId)
  const overdue =
    task.status !== 'done' && task.due !== null && task.due < today
  const hasAny = task.due || subject || (showPriority && task.priority > 0)
  if (!hasAny) return null
  return (
    <span
      className={cn(
        'flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-fg-subtle',
        className,
      )}
    >
      {task.due && (
        <span
          className={cn(
            'inline-flex items-center gap-1',
            overdue && 'text-rose-300 light:text-rose-600',
          )}
        >
          <CalendarIcon />
          {formatDue(task.due, today)}
          {task.time && ` · ${formatTime(task.time)}`}
        </span>
      )}
      {task.recurrence && (
        <span className="inline-flex items-center gap-1">
          <RepeatIcon />
          {describeRecurrence(task.recurrence)}
        </span>
      )}
      {subject && (
        <span className="inline-flex items-center gap-1.5">
          <span
            aria-hidden="true"
            className="size-2 rounded-full"
            style={{ background: SUBJECT_COLORS[subject.color] }}
          />
          {subject.name}
        </span>
      )}
      {showPriority && task.priority > 0 && (
        <span
          className={cn(
            'font-medium',
            task.priority === 3
              ? 'text-rose-300 light:text-rose-600'
              : task.priority === 2
                ? 'text-amber-200 light:text-amber-700'
                : 'text-sky-200 light:text-sky-700',
          )}
        >
          {PRIORITY_NAMES[task.priority]} priority
        </span>
      )}
    </span>
  )
}
