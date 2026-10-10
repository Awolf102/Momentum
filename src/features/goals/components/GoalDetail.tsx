import { useId, useState } from 'react'
import { Link, Redirect } from 'wouter'
import { GlassCard } from '@/components/GlassCard'
import {
  ArrowLeftIcon,
  GoalIcon,
  PencilIcon,
  TrashIcon,
  TrophyIcon,
  UndoIcon,
} from '@/components/icons'
import { findSubject, SubjectDot, subjectsStore } from '@/features/subjects'
import { cn } from '@/lib/cn'
import { formatDateKey, toDateKey } from '@/lib/date'
import { navigate, paths } from '@/lib/routes'
import { useStore } from '@/lib/store'
import { toast } from '@/lib/toast'
import { useToday } from '@/lib/useToday'
import {
  achieveGoal,
  archiveGoal,
  deleteGoal,
  reopenGoal,
  restoreGoal,
  revertGoal,
} from '../actions'
import { useGoalViews, type GoalView } from '../hooks/useGoals'
import type { Goal } from '../types'
import { GoalHabits } from './GoalHabits'
import { GoalSheet } from './GoalSheet'
import { GoalTasks } from './GoalTasks'
import { Milestones } from './Milestones'
import { ProgressBar } from './ProgressBar'
import {
  onGlass,
  PACE,
  percent,
  plural,
  primary,
  secondary,
  shortDate,
  timeLeft,
} from './ui'

function reach(goal: Goal) {
  void achieveGoal(goal.id)
  toast({
    id: `goal-${goal.id}`,
    icon: <TrophyIcon className="text-amber-300" />,
    title: `Reached: ${goal.title}`,
    description: 'Well done. It’s kept under Reached.',
    action: { label: 'Undo', run: () => void revertGoal(goal) },
    duration: 6000,
  })
}

function putAway(goal: Goal) {
  void archiveGoal(goal.id)
  toast({
    id: `goal-${goal.id}`,
    icon: <GoalIcon />,
    title: `Put away: ${goal.title}`,
    description: 'It’s kept under Put away, to reopen any time.',
    action: { label: 'Undo', run: () => void revertGoal(goal) },
  })
}

function remove(goal: Goal) {
  navigate(paths.goals)
  void deleteGoal(goal.id)
  toast({
    id: `goal-${goal.id}`,
    icon: <TrashIcon />,
    title: 'Goal deleted',
    description: `${goal.title}. Its tasks and habits are kept.`,
    action: { label: 'Undo', run: () => void restoreGoal(goal.id) },
  })
}

/** A goal's page: how far it's come, its milestones, tasks and habits. */
export function GoalDetail({ id }: { id: string }) {
  const view = useGoalViews().find((each) => each.goal.id === id)
  const [editing, setEditing] = useState(false)
  // Subject names and colours, as they change.
  useStore(subjectsStore)
  if (!view) return <Redirect to={paths.goals} replace />
  const { goal, progress } = view
  const subject = findSubject(goal.subjectId)

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 pt-2 pb-8 sm:gap-5 sm:pt-6 lg:pt-2">
      <div className="flex items-start gap-3">
        <Link
          href={paths.goals}
          aria-label="Back to goals"
          className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-full glass text-lg transition hover:bg-tint"
        >
          <ArrowLeftIcon />
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="font-serif text-4xl leading-[1.05] tracking-tight break-words text-shadow-soft sm:text-5xl">
            {goal.title}
          </h1>
          {(subject || goal.target) && (
            <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-fg-muted text-shadow-soft">
              {subject && (
                <span className="inline-flex items-center gap-1.5">
                  <SubjectDot color={subject.color} />
                  {subject.name}
                </span>
              )}
              {subject && goal.target && <span aria-hidden="true">·</span>}
              {goal.target && (
                <span>
                  Reach it by{' '}
                  {formatDateKey(goal.target, {
                    weekday: 'short',
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })}
                </span>
              )}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={() => setEditing(true)}
          className={cn(onGlass, 'shrink-0')}
        >
          <PencilIcon /> Edit
        </button>
      </div>

      {goal.why && (
        <p className="border-l-2 border-orange-300/60 pl-4 text-[15px] leading-relaxed whitespace-pre-line text-fg-muted text-shadow-soft">
          {goal.why}
        </p>
      )}

      {goal.status !== 'active' && <ClosedBanner goal={goal} />}

      <ProgressCard view={view} />
      <Milestones goal={goal} />
      <GoalTasks goal={goal} linked={view.tasks} />
      <GoalHabits
        goal={goal}
        linked={view.habits}
        habitRate={progress.habitRate}
      />

      <div className="flex flex-wrap items-center gap-2 pt-1">
        {goal.status === 'active' && progress.share !== 1 && (
          <button type="button" onClick={() => reach(goal)} className={onGlass}>
            <TrophyIcon /> Mark it reached
          </button>
        )}
        {goal.status === 'active' && (
          <button
            type="button"
            onClick={() => putAway(goal)}
            className={onGlass}
          >
            <GoalIcon /> Put it away
          </button>
        )}
        <button
          type="button"
          onClick={() => remove(goal)}
          className={cn(onGlass, 'text-rose-300 light:text-rose-600')}
        >
          <TrashIcon /> Delete goal
        </button>
      </div>

      <GoalSheet open={editing} goal={goal} onClose={() => setEditing(false)} />
    </div>
  )
}

/** Reached or put away: when, and a way back. */
function ClosedBanner({ goal }: { goal: Goal }) {
  const today = useToday()
  const reached = goal.status === 'achieved'
  const when = goal.closedAt
    ? shortDate(toDateKey(new Date(goal.closedAt)), today)
    : null
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-[24px] glass p-4">
      <span
        className={cn(
          'grid size-11 shrink-0 place-items-center rounded-2xl text-xl',
          reached
            ? 'bg-linear-to-br from-amber-300/30 to-orange-500/30 text-amber-200 ring-1 ring-amber-300/40 light:text-amber-700'
            : 'bg-tint text-fg-muted',
        )}
      >
        {reached ? <TrophyIcon /> : <GoalIcon />}
      </span>
      <p className="min-w-0 flex-1 text-[15px]">
        <span className="font-semibold">
          {reached ? 'Reached' : 'Put away'}
        </span>
        {when && <span className="text-fg-muted"> on {when}</span>}
      </p>
      <button
        type="button"
        onClick={() => void reopenGoal(goal.id)}
        className={secondary}
      >
        <UndoIcon /> Reopen
      </button>
    </div>
  )
}

/** The bar, how much is done, and whether that's on track for the day. */
function ProgressCard({ view }: { view: GoalView }) {
  const headingId = useId()
  const today = useToday()
  const { goal, progress } = view
  const allDone = progress.share === 1

  return (
    <GlassCard aria-labelledby={headingId} className="p-5 sm:p-6">
      <h2 id={headingId} className="sr-only">
        Progress
      </h2>
      {progress.share === null ? (
        <p className="text-sm leading-relaxed text-fg-muted">
          Add milestones or tasks below, and a bar here fills as you tick them
          off.
          {goal.target &&
            progress.daysLeft !== null &&
            ` ${timeLeft(progress.daysLeft)} until ${shortDate(goal.target, today)}.`}
        </p>
      ) : (
        <>
          <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
            <p className="flex items-baseline gap-2">
              <span className="font-serif text-5xl leading-none tabular-nums">
                {percent(progress.share)}
              </span>
              <span className="text-sm text-fg-muted">of the way there</span>
            </p>
            <p className="flex items-center gap-2 text-sm text-fg-muted tabular-nums">
              {progress.done} of {plural(progress.steps, 'step')} done
              {!allDone && progress.pace && (
                <span
                  className={cn(
                    'rounded-full px-2.5 py-0.5 text-xs font-semibold',
                    PACE[progress.pace].tone,
                  )}
                >
                  {PACE[progress.pace].label}
                </span>
              )}
            </p>
          </div>
          <ProgressBar
            share={progress.share}
            elapsed={progress.elapsed}
            label={`${percent(progress.share)} of the steps done`}
            className="mt-4"
          />
          {goal.target &&
            progress.elapsed !== null &&
            progress.daysLeft !== null && (
              <p className="mt-3 flex items-center gap-2 text-xs text-fg-subtle">
                <span
                  aria-hidden="true"
                  className="inline-block h-3 w-0.5 rounded-full bg-fg/70"
                />
                {percent(progress.elapsed)} of the time to{' '}
                {shortDate(goal.target, today)} has gone ·{' '}
                {timeLeft(progress.daysLeft)}
              </p>
            )}
          {progress.overdue > 0 && (
            <p className="mt-2 text-xs text-rose-300 light:text-rose-600">
              {progress.overdue === 1
                ? 'A milestone is past its day.'
                : `${progress.overdue} milestones are past their day.`}
            </p>
          )}
          {allDone && goal.status === 'active' && (
            <div className="mt-4 flex flex-wrap items-center gap-3 rounded-2xl bg-emerald-400/10 p-3 pl-4">
              <p className="min-w-0 flex-1 text-sm font-medium">
                Every step is done.
              </p>
              <button
                type="button"
                onClick={() => reach(goal)}
                className={primary}
              >
                <TrophyIcon /> Mark it reached
              </button>
            </div>
          )}
        </>
      )}
    </GlassCard>
  )
}
