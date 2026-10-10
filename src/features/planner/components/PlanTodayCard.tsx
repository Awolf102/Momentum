import { Link } from 'wouter'
import { GlassCard } from '@/components/GlassCard'
import { ChevronRightIcon, PlayIcon } from '@/components/icons'
import { focusTimerStore, startFocus } from '@/features/focus'
import { SUBJECT_COLORS, subjectsStore } from '@/features/subjects'
import { tasks } from '@/features/tasks'
import { paths } from '@/lib/routes'
import { useStore } from '@/lib/store'
import { useClock } from '@/lib/useClock'
import { useToday } from '@/lib/useToday'
import { blocks } from '../blocks'
import { calendars } from '../calendars'
import {
  CALENDAR_SWATCHES,
  FOCUS_SWATCH,
  OTHER_SWATCH,
  TASK_SWATCH,
} from '../lib/colors'
import { eventsOnDay } from '../lib/day'
import { formatClock, formatSpan } from '../lib/time'
import type { Block } from '../types'

interface Entry {
  key: string
  title: string
  detail: string
  start: number
  end: number
  color: string
  block: Block | null
}

/** On the dashboard: what's on now and next today, from the plan and calendars. */
export function PlanTodayCard() {
  const today = useToday()
  const clock = useClock()
  const now = clock.getHours() * 60 + clock.getMinutes()
  const allBlocks = useStore(blocks)
  const allCalendars = useStore(calendars)
  const allTasks = useStore(tasks)
  const { subjects } = useStore(subjectsStore)
  const timer = useStore(focusTimerStore)

  const subjectOf = (id: string | null) =>
    id ? subjects.find((subject) => subject.id === id) : undefined
  const entries: Entry[] = [
    ...allBlocks
      .filter((block) => block.day === today)
      .map((block) => {
        const subject = subjectOf(block.subjectId)
        const task = block.taskId
          ? allTasks.find((each) => each.id === block.taskId)
          : undefined
        return {
          key: block.id,
          title:
            task?.title ||
            block.title ||
            (block.kind === 'focus'
              ? subject
                ? `Focus: ${subject.name}`
                : 'Focus'
              : 'Untitled block'),
          detail: subject?.name ?? '',
          start: block.start,
          end: block.end,
          color: subject
            ? SUBJECT_COLORS[subject.color]
            : block.kind === 'task'
              ? TASK_SWATCH
              : block.kind === 'focus'
                ? FOCUS_SWATCH
                : OTHER_SWATCH,
          block,
        }
      }),
    ...eventsOnDay(allCalendars, today)
      .filter((event) => !event.allDay)
      .map((event) => ({
        key: event.key,
        title: event.title || 'Busy',
        detail: event.location,
        start: event.start,
        end: event.end,
        color: CALENDAR_SWATCHES[event.color],
        block: null,
      })),
  ].sort((a, b) => a.start - b.start || a.end - b.end)

  const current = entries.filter(
    (entry) => entry.start <= now && entry.end > now,
  )
  const next = entries.filter((entry) => entry.start > now)
  const shown = [...current, ...next].slice(0, 3)

  return (
    <GlassCard aria-labelledby="plan-today" className="p-5">
      <div className="flex items-center justify-between gap-3">
        <h2
          id="plan-today"
          className="text-xs font-semibold tracking-[0.14em] text-fg-subtle uppercase"
        >
          Today’s plan
        </h2>
        <Link
          href={paths.plan}
          className="inline-flex items-center gap-0.5 rounded-full px-2.5 py-1 text-xs font-semibold text-fg-muted transition hover:bg-tint hover:text-fg"
        >
          {entries.length > 0 ? 'Open the plan' : 'Plan the day'}
          <ChevronRightIcon />
        </Link>
      </div>
      {shown.length === 0 ? (
        <p className="mt-2 text-sm text-fg-muted">
          {entries.length > 0
            ? 'That’s everything planned for today.'
            : 'Nothing planned. Set aside time for tasks and focus, around your classes.'}
        </p>
      ) : (
        <ul className="mt-3 space-y-2">
          {shown.map((entry) => {
            const isNow = entry.start <= now && entry.end > now
            const canStart =
              isNow && entry.block?.kind === 'focus' && timer.phase === null
            return (
              <li key={entry.key} className="flex items-center gap-3">
                <span
                  className="h-9 w-1 shrink-0 rounded-full"
                  style={{ background: entry.color }}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">
                    {entry.title}
                  </p>
                  <p className="truncate text-xs text-fg-subtle">
                    {isNow
                      ? `Now, until ${formatClock(entry.end)}`
                      : formatSpan(entry.start, entry.end)}
                    {entry.detail ? ` · ${entry.detail}` : ''}
                  </p>
                </div>
                {canStart && entry.block && (
                  <button
                    type="button"
                    onClick={() => startFocus(entry.block!.subjectId)}
                    className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-tint px-3 py-1.5 text-xs font-semibold transition hover:bg-line"
                  >
                    <PlayIcon /> Start
                  </button>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </GlassCard>
  )
}
