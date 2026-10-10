import { motion } from 'motion/react'
import { CheckIcon } from '@/components/icons'
import { SUBJECT_COLORS } from '@/features/subjects'
import { cn } from '@/lib/cn'
import { formatDateKey, type DateKey } from '@/lib/date'
import { toggleHabit } from '../checkIns'
import type { DotState } from '../lib/summary'
import type { Habit } from '../types'

/** Tick a habit off for today (or untick it). */
export function HabitCheck({
  habit,
  done,
  due,
  day,
}: {
  habit: Habit
  done: boolean
  /** Whether today is one of its days (it can still be done on others). */
  due: boolean
  day: DateKey
}) {
  const color = SUBJECT_COLORS[habit.color]
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={done}
      aria-label={`${habit.name}${due ? '' : ' (a day off)'}`}
      onClick={() => void toggleHabit(habit.id, day)}
      className={cn(
        'relative grid size-8 shrink-0 place-items-center rounded-full transition hover:scale-105 active:scale-95',
        !done && (due ? 'ring-2' : 'border border-dashed border-fg-subtle'),
      )}
      style={
        done
          ? { background: color, color: 'oklch(0.2 0.03 260)' }
          : due
            ? { ['--tw-ring-color' as string]: color }
            : undefined
      }
    >
      {done && (
        <motion.span
          initial={{ scale: 0.4, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 520, damping: 22 }}
        >
          <CheckIcon strokeWidth={3} className="text-sm" />
        </motion.span>
      )}
    </button>
  )
}

/** The last seven days at a glance. */
export function WeekDots({
  habit,
  week,
}: {
  habit: Habit
  week: { day: DateKey; label: string; state: DotState }[]
}) {
  const color = SUBJECT_COLORS[habit.color]
  return (
    <ol className="flex items-end gap-1" aria-label="The last seven days">
      {week.map(({ day, label, state }) => (
        <li
          key={day}
          className="flex flex-col items-center gap-1"
          title={`${formatDateKey(day, { weekday: 'long', day: 'numeric', month: 'short' })}: ${
            state === 'done'
              ? 'done'
              : state === 'missed'
                ? 'missed'
                : state === 'open'
                  ? 'still to do'
                  : 'a day off'
          }`}
        >
          <span className="text-[9px] leading-none text-fg-subtle">
            {label}
          </span>
          <span
            className={cn(
              'block size-2.5 rounded-full',
              state === 'missed' && 'ring-1 ring-fg-subtle',
              state === 'open' && 'ring-1',
              state === 'off' && 'bg-tint',
            )}
            style={
              state === 'done'
                ? { background: color }
                : state === 'open'
                  ? { ['--tw-ring-color' as string]: color }
                  : undefined
            }
          />
        </li>
      ))}
    </ol>
  )
}
