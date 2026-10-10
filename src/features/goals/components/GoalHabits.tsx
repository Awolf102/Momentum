import { useId, useState, type FormEvent } from 'react'
import { GlassCard } from '@/components/GlassCard'
import { CloseIcon, LinkIcon, PlusIcon } from '@/components/icons'
import { Sheet } from '@/components/Sheet'
import {
  addHabit,
  describeRun,
  describeSchedule,
  editHabit,
  HabitCheck,
  lastWeek,
  MAX_HABIT_NAME,
  useHabitDays,
  useHabits,
  WeekDots,
} from '@/features/habits'
import { SUBJECT_COLORS } from '@/features/subjects'
import { cn } from '@/lib/cn'
import type { DateKey } from '@/lib/date'
import { toast } from '@/lib/toast'
import { useToday } from '@/lib/useToday'
import { linkHabit, unlinkHabit } from '../actions'
import { MAX_LINKS } from '../goals'
import type { LinkedHabit } from '../hooks/useGoals'
import type { Goal } from '../types'
import { percent, quiet, sectionTitle } from './ui'

const NONE: ReadonlySet<DateKey> = new Set()

/** Habits that build towards a goal, with their streaks and the last four weeks. */
export function GoalHabits({
  goal,
  linked,
  habitRate,
}: {
  goal: Goal
  linked: readonly LinkedHabit[]
  habitRate: number | null
}) {
  const headingId = useId()
  const today = useToday()
  const days = useHabitDays()
  const [linking, setLinking] = useState(false)

  return (
    <GlassCard aria-labelledby={headingId} className="p-5 sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <h2
          id={headingId}
          className={cn(sectionTitle, 'flex items-center gap-2')}
        >
          Habits
          {habitRate !== null && (
            <span className="font-medium tracking-normal normal-case tabular-nums">
              {percent(habitRate)} over 4 weeks
            </span>
          )}
        </h2>
        {goal.habitIds.length < MAX_LINKS && (
          <button
            type="button"
            onClick={() => setLinking(true)}
            className={quiet}
          >
            <LinkIcon /> Link a habit
          </button>
        )}
      </div>
      {linked.length === 0 ? (
        <p className="mt-2 text-sm leading-relaxed text-fg-muted">
          Habits that build towards it show their streaks here: problems every
          weekday, a run three times a week.
        </p>
      ) : (
        <ul className="mt-1 divide-y divide-line" aria-label="Linked habits">
          {linked.map(({ habit, summary }) => (
            <li key={habit.id} className="flex items-center gap-3 py-3">
              <HabitCheck
                habit={habit}
                done={summary.doneToday}
                due={summary.dueToday}
                day={today}
              />
              <button
                type="button"
                onClick={() => editHabit(habit.id)}
                className="min-w-0 flex-1 rounded-lg text-left"
              >
                <span className="block truncate text-[15px] leading-snug">
                  {habit.name}
                </span>
                <span className="block text-xs text-fg-subtle">
                  {describeRun(summary, habit.weekdays)} ·{' '}
                  {describeSchedule(habit.weekdays)}
                  {summary.rate !== null &&
                    ` · ${percent(summary.rate)} of 4 weeks`}
                </span>
              </button>
              <span className="hidden sm:block">
                <WeekDots
                  habit={habit}
                  week={lastWeek(
                    days.get(habit.id) ?? NONE,
                    today,
                    habit.weekdays,
                    habit.createdAt.slice(0, 10),
                  )}
                />
              </span>
              <button
                type="button"
                aria-label={`Unlink “${habit.name}”`}
                title="Unlink from this goal (the habit stays)"
                onClick={() => {
                  void unlinkHabit(goal.id, habit.id)
                  toast({
                    id: `goal-unlink-${habit.id}`,
                    icon: <LinkIcon />,
                    title: 'Unlinked from the goal',
                    description: `${habit.name} stays in your habits.`,
                    action: {
                      label: 'Undo',
                      run: () => void linkHabit(goal.id, habit.id),
                    },
                  })
                }}
                className="grid size-8 shrink-0 place-items-center rounded-full text-sm text-fg-subtle transition hover:bg-tint hover:text-fg"
              >
                <CloseIcon />
              </button>
            </li>
          ))}
        </ul>
      )}
      <Sheet
        open={linking}
        onClose={() => setLinking(false)}
        title="Link a habit"
      >
        {linking && <HabitPicker goal={goal} />}
      </Sheet>
    </GlassCard>
  )
}

/** Habits you have, to link, or a new one made and linked at once. */
function HabitPicker({ goal }: { goal: Goal }) {
  const habits = useHabits()
  const [name, setName] = useState('')
  const free = habits.filter((habit) => !goal.habitIds.includes(habit.id))

  function submit(event: FormEvent) {
    event.preventDefault()
    const habit = addHabit(name)
    if (!habit) return
    void linkHabit(goal.id, habit.id)
    setName('')
  }

  return (
    <div className="space-y-4 pt-1">
      {free.length > 0 ? (
        <ul className="divide-y divide-line" aria-label="Habits to link">
          {free.map((habit) => (
            <li key={habit.id} className="flex items-center gap-3 py-2.5">
              <span
                className="size-2.5 shrink-0 rounded-full"
                style={{ background: SUBJECT_COLORS[habit.color] }}
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[15px]">{habit.name}</span>
                <span className="text-xs text-fg-subtle">
                  {describeSchedule(habit.weekdays)}
                </span>
              </span>
              <button
                type="button"
                aria-label={`Link “${habit.name}”`}
                onClick={() => void linkHabit(goal.id, habit.id)}
                className="shrink-0 rounded-full bg-tint px-3.5 py-1.5 text-xs font-semibold transition hover:bg-line"
              >
                Link
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-fg-muted">
          {habits.length > 0
            ? 'Every habit is linked already.'
            : 'You have no habits yet.'}{' '}
          Make one here and it’s linked to this goal.
        </p>
      )}
      <form
        onSubmit={submit}
        className="flex items-center gap-2 rounded-2xl bg-tint py-1 pr-1 pl-3.5 ring-1 ring-transparent transition focus-within:ring-orange-300/50"
      >
        <PlusIcon className="shrink-0 text-base text-fg-subtle" />
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="A new habit, e.g. 10 problems a day"
          aria-label="New habit for this goal"
          maxLength={MAX_HABIT_NAME}
          className="h-10 min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-fg-subtle focus-visible:outline-none"
        />
        <button
          type="submit"
          disabled={!name.trim()}
          className="rounded-xl bg-linear-to-br from-amber-300 to-orange-500 px-3.5 py-2 text-xs font-semibold text-orange-950 transition disabled:opacity-0"
        >
          Add
        </button>
      </form>
      <p className="text-xs text-fg-subtle">
        New habits are for every day; tap one on the goal to choose its days.
      </p>
    </div>
  )
}
