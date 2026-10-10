import { Link } from 'wouter'
import { GlassCard } from '@/components/GlassCard'
import { ChevronRightIcon, GoalIcon } from '@/components/icons'
import { cn } from '@/lib/cn'
import { paths } from '@/lib/routes'
import { useGoalViews } from '../hooks/useGoals'
import { ProgressBar } from './ProgressBar'
import { PACE, percent, plural, timeLeft } from './ui'

/** Shown on the dashboard. */
const SHOWN = 3

/** On the dashboard, while there are goals on the go: the first few, filling up. */
export function GoalsCard() {
  const active = useGoalViews().filter((view) => view.goal.status === 'active')
  if (active.length === 0) return null
  return (
    <GlassCard aria-labelledby="goals-card" className="p-5">
      <div className="flex items-center justify-between gap-3">
        <h2
          id="goals-card"
          className="flex items-center gap-2 text-xs font-semibold tracking-[0.14em] text-fg-subtle uppercase"
        >
          <GoalIcon className="text-sm" />
          Goals
        </h2>
        <Link
          href={paths.goals}
          className="inline-flex items-center gap-0.5 rounded-full px-2.5 py-1 text-xs font-semibold text-fg-muted transition hover:bg-tint hover:text-fg"
        >
          {active.length > SHOWN ? `All ${active.length} goals` : 'Open goals'}
          <ChevronRightIcon />
        </Link>
      </div>
      <ul className="mt-3 space-y-4">
        {active.slice(0, SHOWN).map(({ goal, progress }) => (
          <li key={goal.id}>
            <Link
              href={paths.goal(goal.id)}
              className="-mx-2 block rounded-2xl px-2 py-1.5 transition hover:bg-tint"
            >
              <span className="flex items-baseline justify-between gap-3">
                <span className="min-w-0 truncate text-sm font-semibold">
                  {goal.title}
                </span>
                {progress.share !== null && (
                  <span className="shrink-0 text-sm font-semibold tabular-nums">
                    {percent(progress.share)}
                  </span>
                )}
              </span>
              {progress.share !== null && (
                <ProgressBar
                  share={progress.share}
                  elapsed={progress.elapsed}
                  label={`${goal.title}: ${percent(progress.share)} of the steps done`}
                  size="sm"
                  className="mt-2"
                />
              )}
              <span className="mt-1.5 flex flex-wrap items-center gap-x-2 text-xs text-fg-subtle">
                {progress.steps > 0 ? (
                  <span className="tabular-nums">
                    {progress.done} of {plural(progress.steps, 'step')}
                  </span>
                ) : (
                  <span>No steps yet</span>
                )}
                {progress.pace && progress.share !== 1 && (
                  <span
                    className={cn(
                      'font-semibold',
                      progress.pace === 'behind'
                        ? 'text-rose-300 light:text-rose-600'
                        : progress.pace === 'ahead'
                          ? 'text-emerald-300 light:text-emerald-700'
                          : 'text-sky-300 light:text-sky-700',
                    )}
                  >
                    {PACE[progress.pace].label}
                  </span>
                )}
                {progress.daysLeft !== null && (
                  <span>{timeLeft(progress.daysLeft)}</span>
                )}
                {progress.next && (
                  <span className="min-w-0 truncate">
                    Next: {progress.next.title}
                  </span>
                )}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </GlassCard>
  )
}
