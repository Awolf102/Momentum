import { cn } from '@/lib/cn'
import type { Weekday } from '@/lib/date'

// Monday first, as weeks are usually planned.
const DAYS: [Weekday, string][] = [
  [1, 'M'],
  [2, 'T'],
  [3, 'W'],
  [4, 'T'],
  [5, 'F'],
  [6, 'S'],
  [0, 'S'],
]
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

/**
 * Which days of the week something is due. An empty list means every day;
 * at least one day always stays chosen.
 */
export function DayPicker({
  value,
  onChange,
}: {
  value: Weekday[]
  onChange: (weekdays: Weekday[]) => void
}) {
  const all = value.length === 0 || value.length === 7
  return (
    <div className="space-y-2">
      <div className="flex gap-1.5">
        {DAYS.map(([day, letter]) => {
          const on = all || value.includes(day)
          return (
            <button
              key={day}
              type="button"
              role="checkbox"
              aria-checked={on}
              aria-label={DAY_NAMES[day]}
              onClick={() => {
                const current = all ? DAYS.map(([d]) => d) : value
                const next = on
                  ? current.filter((d) => d !== day)
                  : [...current, day]
                // At least one day; all seven is "every day".
                if (next.length === 0) return
                onChange(next.length === 7 ? [] : (next.sort() as Weekday[]))
              }}
              className={cn(
                'grid size-9 place-items-center rounded-full text-sm font-semibold transition',
                on
                  ? 'bg-orange-400 text-orange-950'
                  : 'bg-tint text-fg-muted hover:text-fg',
              )}
            >
              {letter}
            </button>
          )
        })}
      </div>
      <p className="text-xs text-fg-subtle">
        {all
          ? 'Every day.'
          : 'Only these days count toward its streak; days off never break it.'}
      </p>
    </div>
  )
}
