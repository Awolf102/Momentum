import { useState, type ReactNode } from 'react'
import { Link } from 'wouter'
import {
  ChevronDownIcon,
  ChevronUpIcon,
  GoalIcon,
  PlusIcon,
  TrophyIcon,
} from '@/components/icons'
import { findSubject, SubjectDot, subjectsStore } from '@/features/subjects'
import { cn } from '@/lib/cn'
import { toDateKey } from '@/lib/date'
import { paths } from '@/lib/routes'
import { useStore } from '@/lib/store'
import { useToday } from '@/lib/useToday'
import { moveGoal } from '../actions'
import { useGoalViews, type GoalView } from '../hooks/useGoals'
import { ProgressBar } from './ProgressBar'
import {
  PACE,
  percent,
  plural,
  primary,
  sectionTitle,
  shortDate,
  timeLeft,
} from './ui'

/** The Goals page: active goals in their order, then reached and put away ones. */
export function GoalsHome({ onNew }: { onNew: () => void }) {
  const views = useGoalViews()
  const active = views.filter((view) => view.goal.status === 'active')
  const reached = views.filter((view) => view.goal.status === 'achieved')
  const away = views.filter((view) => view.goal.status === 'archived')

  if (views.length === 0) return <EmptyGoals onNew={onNew} />
  return (
    <div className="space-y-8">
      <button type="button" onClick={onNew} className={primary}>
        <PlusIcon /> New goal
      </button>
      {active.length > 0 ? (
        <ul className="space-y-3" aria-label="Goals">
          {active.map((view, index) => (
            <GoalRow
              key={view.goal.id}
              view={view}
              canMoveUp={index > 0}
              canMoveDown={index < active.length - 1}
            />
          ))}
        </ul>
      ) : (
        <p className="text-sm text-fg-muted">
          Nothing on the go. Start a new goal, or reopen one below.
        </p>
      )}
      {reached.length > 0 && (
        <ClosedGoals title="Reached" views={reached} reached />
      )}
      {away.length > 0 && <ClosedGoals title="Put away" views={away} />}
    </div>
  )
}

function EmptyGoals({ onNew }: { onNew: () => void }) {
  return (
    <div className="rounded-[28px] glass p-6 sm:p-8">
      <span className="flex size-12 items-center justify-center rounded-2xl bg-linear-to-br from-amber-300/25 to-orange-500/25 text-2xl text-orange-300 ring-1 ring-orange-300/30 light:text-orange-500">
        <GoalIcon />
      </span>
      <h2 className="mt-4 text-xl font-semibold tracking-tight">
        Aim for something bigger
      </h2>
      <p className="mt-2 max-w-prose text-sm leading-relaxed text-fg-muted">
        A goal gathers the milestones on the way, the tasks that are steps
        towards it and the habits that build it, with a bar that fills as you
        go. Give it a day to reach it by, and it says whether you’re on track.
      </p>
      <button type="button" onClick={onNew} className={cn(primary, 'mt-5')}>
        <PlusIcon /> New goal
      </button>
    </div>
  )
}

/** One active goal: how far it's come, and what's next. */
function GoalRow({
  view,
  canMoveUp,
  canMoveDown,
}: {
  view: GoalView
  canMoveUp: boolean
  canMoveDown: boolean
}) {
  const { goal, progress } = view
  const today = useToday()
  // Subject names and colours, as they change.
  useStore(subjectsStore)
  const subject = findSubject(goal.subjectId)
  const allDone = progress.share === 1
  return (
    <li className="flex items-stretch gap-1 rounded-[24px] glass transition hover:bg-tint">
      <Link
        href={paths.goal(goal.id)}
        className="min-w-0 flex-1 rounded-[24px] px-4 py-4 sm:px-5"
      >
        <span className="flex items-start justify-between gap-3">
          <span className="min-w-0">
            <span className="block text-[17px] leading-snug font-semibold break-words">
              {goal.title}
            </span>
            <span className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-fg-subtle">
              {subject && (
                <>
                  <SubjectDot color={subject.color} />
                  <span>{subject.name}</span>
                </>
              )}
              {subject && goal.target && <span aria-hidden="true">·</span>}
              {goal.target && progress.daysLeft !== null && (
                <span
                  className={cn(
                    progress.daysLeft < 0 &&
                      !allDone &&
                      'text-rose-300 light:text-rose-600',
                  )}
                >
                  By {shortDate(goal.target, today)} ·{' '}
                  {timeLeft(progress.daysLeft)}
                </span>
              )}
            </span>
          </span>
          {progress.share !== null && (
            <span className="shrink-0 font-serif text-2xl leading-none tabular-nums">
              {percent(progress.share)}
            </span>
          )}
        </span>
        {progress.share !== null ? (
          <ProgressBar
            share={progress.share}
            elapsed={progress.elapsed}
            label={`${goal.title}: ${percent(progress.share)} of the steps done`}
            className="mt-3"
          />
        ) : null}
        <span className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-fg-muted">
          {progress.steps > 0 ? (
            <span className="tabular-nums">
              {progress.done} of {plural(progress.steps, 'step')}
            </span>
          ) : (
            <span>No steps yet</span>
          )}
          {allDone ? (
            <span className="font-semibold text-emerald-300 light:text-emerald-700">
              Every step done
            </span>
          ) : (
            progress.pace && (
              <span
                className={cn(
                  'rounded-full px-2 py-0.5 font-semibold',
                  PACE[progress.pace].tone,
                )}
              >
                {PACE[progress.pace].label}
              </span>
            )
          )}
          {progress.next && !allDone && (
            <span className="min-w-0 truncate">
              Next: {progress.next.title}
            </span>
          )}
          {progress.habitRate !== null && (
            <span className="tabular-nums">
              Habits {percent(progress.habitRate)}
            </span>
          )}
        </span>
      </Link>
      {(canMoveUp || canMoveDown) && (
        <span className="flex flex-col justify-center gap-1 py-2 pr-2">
          <MoveButton
            label={`Move “${goal.title}” up`}
            disabled={!canMoveUp}
            onClick={() => void moveGoal(goal.id, -1)}
          >
            <ChevronUpIcon />
          </MoveButton>
          <MoveButton
            label={`Move “${goal.title}” down`}
            disabled={!canMoveDown}
            onClick={() => void moveGoal(goal.id, 1)}
          >
            <ChevronDownIcon />
          </MoveButton>
        </span>
      )}
    </li>
  )
}

function MoveButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string
  disabled: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className="grid size-8 place-items-center rounded-full text-base text-fg-muted transition hover:bg-tint hover:text-fg disabled:opacity-25"
    >
      {children}
    </button>
  )
}

/** Reached or put-away goals, folded away until wanted. */
function ClosedGoals({
  title,
  views,
  reached = false,
}: {
  title: string
  views: GoalView[]
  reached?: boolean
}) {
  const [open, setOpen] = useState(false)
  const today = useToday()
  return (
    <section>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className={cn(sectionTitle, 'flex items-center gap-1.5 hover:text-fg')}
      >
        {title}
        <span className="font-medium tracking-normal normal-case tabular-nums">
          {views.length}
        </span>
        {open ? <ChevronUpIcon /> : <ChevronDownIcon />}
      </button>
      {open && (
        <ul className="mt-3 space-y-2" aria-label={`${title} goals`}>
          {views.map(({ goal, progress }) => (
            <li key={goal.id}>
              <Link
                href={paths.goal(goal.id)}
                className="flex items-center gap-3 rounded-[20px] glass px-4 py-3 transition hover:bg-tint"
              >
                <span
                  className={cn(
                    'grid size-8 shrink-0 place-items-center rounded-full text-sm',
                    reached
                      ? 'bg-amber-300/20 text-amber-200 light:text-amber-700'
                      : 'bg-tint text-fg-subtle',
                  )}
                >
                  {reached ? <TrophyIcon /> : <GoalIcon />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-medium">
                    {goal.title}
                  </span>
                  <span className="text-xs text-fg-subtle">
                    {reached ? 'Reached' : 'Put away'}
                    {goal.closedAt &&
                      ` ${shortDate(toDateKey(new Date(goal.closedAt)), today)}`}
                    {progress.steps > 0 &&
                      ` · ${progress.done} of ${plural(progress.steps, 'step')}`}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
