import type { ReactNode } from 'react'
import { GlassCard } from '@/components/GlassCard'
import { CheckIcon, PencilIcon, TimerIcon } from '@/components/icons'
import { cn } from '@/lib/cn'
import { formatDateKey } from '@/lib/date'
import { formatMinutes } from '@/lib/duration'
import type { TimelineDay, TimelineMonth } from '../lib/timeline'
import { useLineEditing } from '../hooks/useLog'
import { editorLabel } from '../lib/text'
import { DayLine, LineText } from './DayLine'
import { LineEditor } from './LineEditor'

/** Today, at the top of the Log page. */
export function LogToday({ day }: { day: TimelineDay }) {
  return (
    <GlassCard className="w-full px-5 py-5 sm:px-6">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-xs font-semibold tracking-[0.2em] text-fg-muted uppercase">
          Today
        </h2>
        <time dateTime={day.day} className="text-xs text-fg-subtle">
          {formatDateKey(day.day, {
            weekday: 'long',
            month: 'long',
            day: 'numeric',
          })}
        </time>
      </div>
      <div className="mt-3">
        <DayLine
          day={day.day}
          line={day.line}
          emptyLabel="What did you do today?"
          placeholder="What did you do today?"
          className="text-base"
        />
      </div>
      <DayFacts day={day} />
    </GlassCard>
  )
}

/** One month of the log, newest day first. */
export function LogMonth({
  month,
  days,
  found,
}: TimelineMonth & {
  /** A day to point out (opened from search). */
  found?: string | null
}) {
  return (
    <GlassCard className="w-full px-5 py-4 sm:px-6">
      <h2 className="pt-1 text-xs font-semibold tracking-[0.2em] text-fg-muted uppercase">
        {formatDateKey(`${month}-01`, { month: 'long', year: 'numeric' })}
      </h2>
      <ol className="mt-1 divide-y divide-line">
        {days.map((day) => (
          <LogDayRow key={day.day} day={day} found={day.day === found} />
        ))}
      </ol>
    </GlassCard>
  )
}

/**
 * A past day. With a line, the line leads; without one, what happened that
 * day does, with a quiet way to add a line (most past days won't have one).
 */
function LogDayRow({ day, found }: { day: TimelineDay; found: boolean }) {
  const { editing, open, close } = useLineEditing(day.day)
  const hasLine = Boolean(day.line) || editing
  return (
    <li
      id={`log-${day.day}`}
      data-found={found || undefined}
      className="flex scroll-mt-24 gap-4 rounded-xl py-3.5 data-found:animate-found"
    >
      <time dateTime={day.day} className="w-10 shrink-0 pt-0.5 text-center">
        <span className="block text-[11px] font-medium tracking-wider text-fg-subtle uppercase">
          {formatDateKey(day.day, { weekday: 'short' })}
        </span>
        <span className="block font-serif text-[1.75rem] leading-none tabular-nums">
          {formatDateKey(day.day, { day: 'numeric' })}
        </span>
      </time>
      <div className={cn('min-w-0 flex-1', hasLine ? 'pt-1' : 'self-center')}>
        {editing ? (
          <LineEditor
            day={day.day}
            placeholder="What did you do?"
            label={editorLabel(day.day)}
            onDone={close}
          />
        ) : (
          day.line && <LineText line={day.line} onEdit={open} />
        )}
        <DayFacts day={day} className={hasLine ? 'mt-1.5' : undefined}>
          {!hasLine && (
            <button
              type="button"
              onClick={open}
              className="inline-flex items-center gap-1 text-fg-subtle underline-offset-4 transition hover:text-fg hover:underline"
            >
              <PencilIcon />
              Add a line
            </button>
          )}
        </DayFacts>
      </div>
    </li>
  )
}

/** What else happened that day: the check-in and focus time. */
function DayFacts({
  day,
  className = 'mt-1.5',
  children,
}: {
  day: TimelineDay
  className?: string
  children?: ReactNode
}) {
  if (!day.checkedIn && !day.focus && !children) return null
  return (
    <p
      className={cn(
        'flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-fg-subtle',
        className,
      )}
    >
      {day.checkedIn && (
        <span className="inline-flex items-center gap-1">
          <CheckIcon
            className="text-orange-300 light:text-orange-500"
            strokeWidth={2.5}
          />
          Checked in
        </span>
      )}
      {day.focus && (
        <span className="inline-flex flex-wrap items-center gap-x-1.5 gap-y-1">
          <TimerIcon />
          {formatMinutes(day.focus.minutes)} focus
          {day.focus.subjects.map((subject) => (
            <span key={subject.id} className="inline-flex items-center gap-1">
              <span
                aria-hidden="true"
                className="ml-1 size-2 rounded-full"
                style={{ background: subject.color }}
              />
              {subject.name}
            </span>
          ))}
        </span>
      )}
      {children}
    </p>
  )
}
