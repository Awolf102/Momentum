import { useState, type ReactNode } from 'react'
import { ActionRow } from '@/components/ActionRow'
import { TrashIcon } from '@/components/icons'
import { DayPicker } from '@/components/DayPicker'
import { Sheet } from '@/components/Sheet'
import { ActivityCalendar } from '@/features/calendar'
import { SUBJECT_COLORS, type SubjectColor } from '@/features/subjects'
import { cn } from '@/lib/cn'
import { formatDateKey, localDay, type DateKey, type Weekday } from '@/lib/date'
import { weekStartsOn } from '@/lib/locale'
import { useStore } from '@/lib/store'
import { useToday } from '@/lib/useToday'
import { useHabitDays, useHabits } from '../hooks/useHabits'
import { depthLevel, summarizeHabit } from '../lib/summary'
import {
  addHabit,
  closeHabitEditor,
  editHabit,
  editingHabitStore,
  MAX_NAME_LENGTH,
  removeHabit,
  updateHabit,
} from '../store'
import type { Habit } from '../types'

const EMPTY = new Set<DateKey>()

/** Adding or editing a habit, with its numbers and its own calendar. */
export function HabitSheet() {
  const editing = useStore(editingHabitStore)
  const habit = useHabits().find((item) => item.id === editing)
  const open = editing === 'new' || Boolean(habit)
  return (
    <Sheet
      open={open}
      onClose={closeHabitEditor}
      title={editing === 'new' ? 'New habit' : 'Habit'}
    >
      {editing === 'new' ? (
        <NewHabit />
      ) : (
        habit && <HabitEditor key={habit.id} habit={habit} />
      )}
    </Sheet>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold tracking-[0.14em] text-fg-subtle uppercase">
        {label}
      </p>
      {children}
    </div>
  )
}

function ColorPicker({
  value,
  onChange,
}: {
  value: SubjectColor
  onChange: (color: SubjectColor) => void
}) {
  return (
    <div role="radiogroup" aria-label="Colour" className="flex flex-wrap gap-2">
      {(Object.keys(SUBJECT_COLORS) as SubjectColor[]).map((color) => (
        <button
          key={color}
          type="button"
          role="radio"
          aria-checked={color === value}
          aria-label={color}
          onClick={() => onChange(color)}
          className={cn(
            'size-7 rounded-full ring-offset-2 ring-offset-transparent transition',
            color === value ? 'ring-2 ring-fg' : 'hover:scale-110',
          )}
          style={{ background: SUBJECT_COLORS[color] }}
        />
      ))}
    </div>
  )
}

function NewHabit() {
  const [name, setName] = useState('')
  const [weekdays, setWeekdays] = useState<Weekday[]>([])
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        const habit = addHabit(name, weekdays)
        if (habit) editHabit(habit.id)
      }}
      className="space-y-6 pt-1"
    >
      <input
        autoFocus
        value={name}
        maxLength={MAX_NAME_LENGTH}
        onChange={(event) => setName(event.target.value)}
        placeholder="e.g. Read 20 pages"
        aria-label="Name"
        className="w-full rounded-xl bg-tint px-3.5 py-3 text-base font-medium outline-none placeholder:text-fg-subtle focus-visible:outline-2"
      />
      <Field label="Days">
        <DayPicker value={weekdays} onChange={setWeekdays} />
      </Field>
      <button
        type="submit"
        disabled={!name.trim()}
        className="w-full rounded-full bg-linear-to-br from-amber-300 via-orange-400 to-orange-500 px-6 py-3 font-semibold text-orange-950 disabled:opacity-40"
      >
        Add habit
      </button>
    </form>
  )
}

function HabitEditor({ habit }: { habit: Habit }) {
  const today = useToday()
  const days = useHabitDays().get(habit.id) ?? EMPTY
  const [name, setName] = useState(habit.name)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const summary = summarizeHabit(
    days,
    today,
    habit.weekdays,
    localDay(habit.createdAt),
  )
  const levels = new Map(
    [...summary.depths].map(([day, depth]) => [day, depthLevel(depth)]),
  )

  return (
    <div className="space-y-6 pt-1">
      <input
        value={name}
        maxLength={MAX_NAME_LENGTH}
        onChange={(event) => setName(event.target.value)}
        onBlur={() =>
          name.trim()
            ? name !== habit.name && updateHabit(habit.id, { name })
            : setName(habit.name)
        }
        onKeyDown={(event) =>
          event.key === 'Enter' && event.currentTarget.blur()
        }
        aria-label="Name"
        className="w-full rounded-xl bg-tint px-3.5 py-3 text-base font-medium outline-none focus-visible:outline-2"
      />

      <dl className="grid grid-cols-4 gap-2 text-center">
        {(
          [
            ['Streak', summary.current],
            ['Longest', summary.longest],
            ['Done', summary.total],
            [
              '4 weeks',
              summary.rate === null
                ? '—'
                : `${Math.round(summary.rate * 100)}%`,
            ],
          ] as const
        ).map(([label, value]) => (
          <div key={label} className="rounded-2xl bg-tint px-1 py-3">
            <dd className="font-serif text-2xl leading-none tabular-nums">
              {value}
            </dd>
            <dt className="mt-1.5 text-[11px] text-fg-subtle">{label}</dt>
          </div>
        ))}
      </dl>

      <Field label="Days">
        <DayPicker
          value={habit.weekdays}
          onChange={(weekdays) => updateHabit(habit.id, { weekdays })}
        />
      </Field>

      <Field label="Colour">
        <ColorPicker
          value={habit.color}
          onChange={(color) => updateHabit(habit.id, { color })}
        />
      </Field>

      <Field label="History">
        <ActivityCalendar
          today={today}
          levels={levels}
          weekStartsOn={weekStartsOn}
          describe={(date) =>
            `${formatDateKey(date, { weekday: 'short', month: 'short', day: 'numeric' })} · ${days.has(date) ? 'done' : 'not done'}`
          }
          label={`${habit.name}: done on ${summary.total} days`}
        />
      </Field>

      <ActionRow
        icon={<TrashIcon />}
        label={
          confirmDelete ? 'Tap again to delete this habit' : 'Delete habit'
        }
        onClick={() => {
          if (!confirmDelete) return setConfirmDelete(true)
          removeHabit(habit.id)
          closeHabitEditor()
        }}
        danger
      />
    </div>
  )
}
