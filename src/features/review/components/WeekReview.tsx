import type { ReactNode } from 'react'
import { useLocation } from 'wouter'
import { GlassCard } from '@/components/GlassCard'
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  TrophyIcon,
} from '@/components/icons'
import { IconButton } from '@/components/IconButton'
import { SUBJECT_COLORS, subjectsStore } from '@/features/subjects'
import { cn } from '@/lib/cn'
import { addDays, formatDateKey, type DateKey } from '@/lib/date'
import { formatMinutes } from '@/lib/duration'
import { paths } from '@/lib/routes'
import { useStore } from '@/lib/store'
import { useToday } from '@/lib/useToday'
import { useWeekSummary } from '../hooks/useWeekSummary'
import { weekOf } from '../lib/weeks'
import { WriteUpCard } from './WriteUpCard'

const label = 'text-xs font-semibold tracking-[0.14em] text-fg-subtle uppercase'

function Section({
  title,
  children,
  className,
}: {
  title: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <GlassCard className={cn('p-5 sm:p-6', className)}>
      <h2 className={label}>{title}</h2>
      <div className="mt-3">{children}</div>
    </GlassCard>
  )
}

function Tile({
  name,
  value,
  hint,
}: {
  name: string
  value: string
  hint?: string
}) {
  return (
    <GlassCard className="px-4 py-3.5 sm:px-5 sm:py-4">
      <p className="text-[11px] font-semibold tracking-[0.12em] text-fg-subtle uppercase">
        {name}
      </p>
      <p className="mt-1.5 font-serif text-3xl leading-none tabular-nums sm:text-4xl">
        {value}
      </p>
      {hint && <p className="mt-1.5 text-xs text-fg-muted">{hint}</p>}
    </GlassCard>
  )
}

const day = (key: DateKey) =>
  formatDateKey(key, { weekday: 'short', day: 'numeric', month: 'short' })

/** Short enough to sit over a bar on a phone: 45m, 2h, 1h30. */
const compact = (minutes: number) =>
  minutes < 60
    ? `${minutes}m`
    : `${Math.floor(minutes / 60)}h${minutes % 60 ? String(minutes % 60).padStart(2, '0') : ''}`

/** A week in review: what you did, day by day and in all. */
export function WeekReview({ week }: { week: DateKey }) {
  const today = useToday()
  const [, navigate] = useLocation()
  const summary = useWeekSummary(week)
  const { subjects } = useStore(subjectsStore)
  const current = weekOf(today)
  const { focus } = summary
  const most = Math.max(...focus.byDay, 1)
  const change = focus.minutes - focus.previousMinutes
  const habitsDue = summary.habits.reduce((sum, habit) => sum + habit.due, 0)
  const habitsDone = summary.habits.reduce((sum, habit) => sum + habit.done, 0)
  const colorOf = (name: string) => {
    const subject = subjects.find((each) => each.name === name)
    return subject ? SUBJECT_COLORS[subject.color] : 'var(--color-fg-subtle)'
  }
  const go = (start: DateKey) =>
    navigate(start === current ? paths.review() : paths.review(start))

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 pt-2 pb-8 sm:gap-5 sm:pt-6 lg:pt-2">
      <div>
        <h1 className="font-serif text-5xl leading-none tracking-tight text-shadow-soft sm:text-6xl">
          Your week
        </h1>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <p
            className="text-lg font-semibold text-shadow-soft"
            aria-live="polite"
          >
            {formatDateKey(summary.start, { day: 'numeric', month: 'long' })} –{' '}
            {formatDateKey(summary.end, { day: 'numeric', month: 'long' })}
            {week === current && (
              <span className="ml-2 rounded-full bg-orange-400/20 px-2 py-0.5 align-middle text-xs font-semibold text-orange-200 light:text-orange-800">
                This week
              </span>
            )}
          </p>
          <div className="flex items-center gap-2">
            <IconButton
              label="The week before"
              onClick={() => go(addDays(week, -7))}
              className="size-9 text-base"
            >
              <ChevronLeftIcon />
            </IconButton>
            <button
              type="button"
              onClick={() => go(current)}
              disabled={week === current}
              className="h-9 rounded-full glass px-4 text-sm font-semibold transition disabled:opacity-50"
            >
              This week
            </button>
            <IconButton
              label="The week after"
              onClick={() => go(addDays(week, 7))}
              disabled={week >= current}
              className="size-9 text-base disabled:opacity-40"
            >
              <ChevronRightIcon />
            </IconButton>
          </div>
        </div>
      </div>

      {summary.empty ? (
        <GlassCard className="p-6">
          <p className="text-[15px] text-fg-muted">
            {week === current
              ? 'Nothing recorded this week yet: focus, habits, tasks and your log show up here as you go.'
              : 'A quiet week: nothing was recorded.'}
          </p>
        </GlassCard>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
            <Tile
              name="Focus"
              value={formatMinutes(focus.minutes)}
              hint={
                focus.previousMinutes || focus.minutes
                  ? change === 0
                    ? 'The same as the week before'
                    : `${change > 0 ? '+' : '−'}${formatMinutes(Math.abs(change))} on the week before`
                  : undefined
              }
            />
            <Tile
              name="Check-ins"
              value={`${summary.checkIns}/${summary.daysSoFar}`}
              hint={summary.daysSoFar < 7 ? 'days so far' : 'days'}
            />
            <Tile
              name="Habits"
              value={
                habitsDue
                  ? `${Math.round((habitsDone / habitsDue) * 100)}%`
                  : '–'
              }
              hint={
                habitsDue ? `${habitsDone} of ${habitsDue} days` : 'none due'
              }
            />
            <Tile
              name="Tasks done"
              value={String(summary.tasksDone.length)}
              hint={
                summary.stillOpen.length
                  ? `${summary.stillOpen.length} due this week still open`
                  : undefined
              }
            />
          </div>

          <Section title="Focus by day">
            {focus.minutes === 0 ? (
              <p className="text-sm text-fg-muted">
                {week === current
                  ? 'No focus sessions yet this week.'
                  : 'No focus sessions this week.'}
              </p>
            ) : (
              <ol
                className="grid h-40 grid-cols-7 items-end gap-2"
                aria-label="Minutes of focus each day"
              >
                {summary.days.map((key, index) => {
                  const minutes = focus.byDay[index]
                  const future = key > today
                  return (
                    <li
                      key={key}
                      className="flex h-full flex-col items-center justify-end gap-1.5"
                      aria-label={`${day(key)}: ${future ? 'still to come' : formatMinutes(minutes)}`}
                    >
                      <span
                        className="text-[11px] whitespace-nowrap text-fg-subtle tabular-nums"
                        aria-hidden
                      >
                        {minutes ? compact(minutes) : ''}
                      </span>
                      <span
                        className={cn(
                          'w-full max-w-10 rounded-t-lg',
                          minutes
                            ? 'bg-linear-to-t from-amber-300 to-orange-500'
                            : 'bg-tint',
                          future && 'opacity-40',
                        )}
                        style={{
                          height: minutes
                            ? `${Math.max(6, (minutes / most) * 100)}%`
                            : 4,
                        }}
                      />
                      <span
                        className={cn(
                          'text-xs font-semibold',
                          key === today ? 'text-orange-300' : 'text-fg-subtle',
                        )}
                      >
                        {formatDateKey(key, { weekday: 'narrow' })}
                      </span>
                    </li>
                  )
                })}
              </ol>
            )}
            {focus.bySubject.length > 0 && (
              <ul className="mt-5 space-y-2" aria-label="Focus by subject">
                {focus.bySubject.map((subject) => (
                  <li
                    key={subject.name || 'none'}
                    className="flex items-center gap-3 text-sm"
                  >
                    <span className="w-28 shrink-0 truncate text-fg-muted">
                      {subject.name || 'No subject'}
                    </span>
                    <span className="h-2 flex-1 overflow-hidden rounded-full bg-tint">
                      <span
                        className="block h-full rounded-full"
                        style={{
                          width: `${(subject.minutes / focus.minutes) * 100}%`,
                          background: colorOf(subject.name),
                        }}
                      />
                    </span>
                    <span className="w-20 shrink-0 text-right text-xs text-fg-muted tabular-nums">
                      {formatMinutes(subject.minutes)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          {summary.habits.length > 0 && (
            <Section title="Habits">
              <ul className="space-y-2" aria-label="Habits this week">
                {summary.habits.map((habit) => (
                  <li
                    key={habit.name}
                    className="flex items-center gap-3 text-sm"
                  >
                    <span className="min-w-0 flex-1 truncate">
                      {habit.name}
                    </span>
                    <span className="text-xs text-fg-muted tabular-nums">
                      {habit.due
                        ? `${habit.done} of ${habit.due} days`
                        : 'none due'}
                    </span>
                  </li>
                ))}
              </ul>
            </Section>
          )}

          <Section title={`Tasks done (${summary.tasksDone.length})`}>
            {summary.tasksDone.length ? (
              <ul className="space-y-1.5" aria-label="Tasks done this week">
                {summary.tasksDone.map((task, index) => (
                  <li
                    key={`${task.title}:${index}`}
                    className="flex items-baseline gap-3 text-sm"
                  >
                    <span className="w-24 shrink-0 text-xs text-fg-subtle">
                      {day(task.day)}
                    </span>
                    <span className="min-w-0 flex-1 break-words">
                      {task.title}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-fg-muted">None this week.</p>
            )}
            {summary.stillOpen.length > 0 && (
              <>
                <h3 className={cn(label, 'mt-5')}>Due this week, still open</h3>
                <ul className="mt-2 space-y-1.5" aria-label="Still open">
                  {summary.stillOpen.map((task, index) => (
                    <li
                      key={`${task.title}:${index}`}
                      className="flex items-baseline gap-3 text-sm"
                    >
                      <span className="w-24 shrink-0 text-xs text-rose-300 light:text-rose-600">
                        {day(task.due)}
                      </span>
                      <span className="min-w-0 flex-1 break-words">
                        {task.title}
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </Section>

          {summary.milestones.length > 0 && (
            <Section title="Milestones reached">
              <ul className="space-y-2" aria-label="Milestones reached">
                {summary.milestones.map((milestone, index) => (
                  <li
                    key={`${milestone.title}:${index}`}
                    className="flex items-start gap-3 text-sm"
                  >
                    <TrophyIcon className="mt-0.5 shrink-0 text-amber-300" />
                    <span className="min-w-0 flex-1">
                      <span className="font-medium">{milestone.title}</span>
                      <span className="text-fg-muted">
                        , towards {milestone.goal}
                      </span>
                    </span>
                    <span className="text-xs text-fg-subtle">
                      {day(milestone.day)}
                    </span>
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {summary.log.length > 0 && (
            <Section title="Your log">
              <ul className="space-y-2" aria-label="Log lines this week">
                {summary.log.map((entry) => (
                  <li key={entry.day} className="flex items-baseline gap-3">
                    <span className="w-24 shrink-0 text-xs text-fg-subtle">
                      {day(entry.day)}
                    </span>
                    <span className="min-w-0 flex-1 text-[15px] break-words">
                      {entry.text}
                    </span>
                  </li>
                ))}
              </ul>
            </Section>
          )}

          <WriteUpCard summary={summary} />
        </>
      )}
    </div>
  )
}
