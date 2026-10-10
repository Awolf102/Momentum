import { motion } from 'motion/react'
import { CheckIcon } from '@/components/icons'
import { cn } from '@/lib/cn'
import {
  addDays,
  formatDateKey,
  startOfWeek,
  type DateKey,
  type Weekday,
} from '@/lib/date'

interface WeekStripProps {
  today: DateKey
  checkedIn: ReadonlySet<DateKey>
  weekStartsOn: Weekday
}

/** This week at a glance: one dot per day, filled when checked in. */
export function WeekStrip({ today, checkedIn, weekStartsOn }: WeekStripProps) {
  const weekStart = startOfWeek(today, weekStartsOn)
  const days = Array.from({ length: 7 }, (_, index) =>
    addDays(weekStart, index),
  )
  const doneCount = days.filter((day) => checkedIn.has(day)).length

  return (
    <ol
      aria-label={`This week: ${doneCount} of 7 days checked in`}
      className="flex items-center justify-center gap-2 sm:gap-3"
    >
      {days.map((day) => {
        const done = checkedIn.has(day)
        const isToday = day === today
        const isFuture = day > today
        const label = formatDateKey(day, { weekday: 'long' })
        return (
          <li
            key={day}
            className="flex flex-col items-center gap-1.5"
            aria-label={`${label}: ${done ? 'checked in' : isFuture ? 'upcoming' : 'not checked in'}`}
          >
            <span
              aria-hidden="true"
              className={cn(
                'text-[11px] font-medium',
                isToday ? 'text-fg' : 'text-fg-subtle',
              )}
            >
              {formatDateKey(day, { weekday: 'narrow' })}
            </span>
            <motion.span
              aria-hidden="true"
              initial={false}
              animate={done && isToday ? { scale: [1, 1.35, 1] } : { scale: 1 }}
              transition={{ duration: 0.5, delay: 0.15 }}
              className={cn(
                'flex size-7 items-center justify-center rounded-full text-sm transition-colors duration-500 sm:size-8',
                done
                  ? 'bg-linear-to-br from-amber-300 to-orange-500 text-orange-950 shadow-[0_0_14px_rgb(251_146_60/0.45)]'
                  : isToday
                    ? 'border-[1.5px] border-dashed border-orange-300/80'
                    : isFuture
                      ? 'bg-tint opacity-50'
                      : 'bg-tint',
              )}
            >
              {done && <CheckIcon strokeWidth={2.75} />}
            </motion.span>
          </li>
        )
      })}
    </ol>
  )
}
