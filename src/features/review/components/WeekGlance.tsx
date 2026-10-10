import { Link } from 'wouter'
import { GlassCard } from '@/components/GlassCard'
import { ChevronRightIcon, SunriseIcon } from '@/components/icons'
import { formatDateKey, type DateKey } from '@/lib/date'
import { formatMinutes } from '@/lib/duration'
import { paths } from '@/lib/routes'
import { useWeekSummary } from '../hooks/useWeekSummary'

/** The week at a glance, with a way into the review. */
export function WeekGlance({ week, last }: { week: DateKey; last: boolean }) {
  const summary = useWeekSummary(week)
  const habitsDue = summary.habits.reduce((sum, habit) => sum + habit.due, 0)
  const habitsDone = summary.habits.reduce((sum, habit) => sum + habit.done, 0)
  const range = `${formatDateKey(summary.start, { day: 'numeric', month: 'short' })} – ${formatDateKey(summary.end, { day: 'numeric', month: 'short' })}`
  const facts = [
    ['Focus', formatMinutes(summary.focus.minutes)],
    ['Check-ins', `${summary.checkIns} of ${summary.daysSoFar}`],
    ...(habitsDue
      ? [['Habits', `${Math.round((habitsDone / habitsDue) * 100)}%`]]
      : []),
    ['Tasks done', String(summary.tasksDone.length)],
  ]
  return (
    <GlassCard aria-labelledby="week-card" className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2
            id="week-card"
            className="flex items-center gap-2 text-xs font-semibold tracking-[0.14em] text-fg-subtle uppercase"
          >
            <SunriseIcon className="text-sm" />
            {last ? 'Last week' : 'Your week'}
          </h2>
          <p className="mt-1 text-sm text-fg-muted">{range}</p>
        </div>
        <Link
          href={paths.review(week)}
          className="-mt-1 inline-flex shrink-0 items-center gap-0.5 rounded-full px-2.5 py-1 text-xs font-semibold whitespace-nowrap text-fg-muted transition hover:bg-tint hover:text-fg"
        >
          See the week
          <ChevronRightIcon />
        </Link>
      </div>
      {summary.empty ? (
        <p className="mt-2 text-sm text-fg-muted">
          A quiet week: nothing was recorded. Next week is a fresh start.
        </p>
      ) : (
        <dl className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {facts.map(([label, value]) => (
            <div key={label} className="rounded-2xl bg-tint px-3 py-2.5">
              <dt className="text-[11px] font-semibold tracking-[0.1em] text-fg-subtle uppercase">
                {label}
              </dt>
              <dd className="mt-0.5 font-serif text-2xl leading-tight tabular-nums">
                {value}
              </dd>
            </div>
          ))}
        </dl>
      )}
    </GlassCard>
  )
}
