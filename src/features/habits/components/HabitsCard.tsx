import { useMemo, useState, type FormEvent } from 'react'
import { GlassCard } from '@/components/GlassCard'
import { PlusIcon, RepeatIcon } from '@/components/icons'
import { localDay } from '@/lib/date'
import { useToday } from '@/lib/useToday'
import { useHabitDays, useHabits } from '../hooks/useHabits'
import {
  describeRun,
  describeSchedule,
  lastWeek,
  summarizeHabit,
} from '../lib/summary'
import { addHabit, editHabit, MAX_NAME_LENGTH } from '../store'
import { HabitCheck, WeekDots } from './HabitParts'

const EMPTY = new Set<string>()

/** Habits beyond the daily check-in, each with its own streak. */
export function HabitsCard() {
  const habits = useHabits()
  const days = useHabitDays()
  const today = useToday()
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')

  const rows = useMemo(
    () =>
      habits.map((habit) => {
        const done = days.get(habit.id) ?? EMPTY
        const since = localDay(habit.createdAt)
        return {
          habit,
          summary: summarizeHabit(done, today, habit.weekdays, since),
          week: lastWeek(done, today, habit.weekdays, since),
        }
      }),
    [habits, days, today],
  )
  const due = rows.filter((row) => row.summary.dueToday)
  const doneDue = due.filter((row) => row.summary.doneToday).length

  function submit(event: FormEvent) {
    event.preventDefault()
    if (addHabit(name)) setName('')
    setAdding(false)
  }

  return (
    <GlassCard className="w-full px-5 py-5 sm:px-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-xs font-semibold tracking-[0.2em] text-fg-muted uppercase">
          <RepeatIcon className="text-sm" />
          Habits
          {due.length > 0 && (
            <span className="font-medium tracking-normal text-fg-subtle normal-case tabular-nums">
              {doneDue} of {due.length} today
            </span>
          )}
        </h2>
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold text-fg-muted transition hover:bg-tint hover:text-fg"
        >
          <PlusIcon /> New habit
        </button>
      </div>

      {rows.length === 0 && !adding && (
        <p className="mt-3 px-1 text-sm leading-relaxed text-fg-subtle">
          Track more than the daily check-in — reading, exercise, practice. Each
          habit keeps its own streak, on the days you choose.
        </p>
      )}

      {rows.length > 0 && (
        <ul className="mt-2 divide-y divide-line">
          {rows.map(({ habit, summary, week }) => (
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
                  {describeRun(summary, habit.weekdays)}
                  {' · '}
                  {describeSchedule(habit.weekdays)}
                </span>
              </button>
              <WeekDots habit={habit} week={week} />
            </li>
          ))}
        </ul>
      )}

      {adding && (
        <form
          onSubmit={submit}
          className="mt-3 flex items-center gap-2 rounded-2xl bg-tint py-1 pr-1 pl-4 ring-1 ring-orange-300/50"
        >
          <input
            autoFocus
            value={name}
            maxLength={MAX_NAME_LENGTH}
            onChange={(event) => setName(event.target.value)}
            onKeyDown={(event) => event.key === 'Escape' && setAdding(false)}
            onBlur={() => !name.trim() && setAdding(false)}
            placeholder="A new habit, e.g. Read 20 pages"
            aria-label="New habit"
            className="h-10 min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-fg-subtle focus-visible:outline-none"
          />
          <button
            type="submit"
            className="rounded-xl bg-linear-to-br from-amber-300 to-orange-500 px-3.5 py-2 text-xs font-semibold text-orange-950"
          >
            Add
          </button>
        </form>
      )}
    </GlassCard>
  )
}
