import { motion } from 'motion/react'
import {
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent,
} from 'react'
import { cn } from '@/lib/cn'
import {
  dayOfWeek,
  formatDateKey,
  type DateKey,
  type Weekday,
} from '@/lib/date'
import { buildCalendar } from '../lib/buildCalendar'
import { CALENDAR_LEVELS, LEVEL_COLORS } from '../lib/levels'

interface ActivityCalendarProps {
  today: DateKey
  /** Intensity per day, 1–4. Missing days are empty. */
  levels: ReadonlyMap<DateKey, number>
  weekStartsOn: Weekday
  /** Tooltip text for a day. */
  describe: (date: DateKey, level: number) => string
  /** Accessible summary of the whole grid. */
  label: string
}

const CELL = 13 // target cell size in px; cells stretch slightly to fill the width
const GAP = 4
const LABEL_COLUMN = 30
const MAX_WEEKS = 53
const MIN_WEEKS = 10

/**
 * A GitHub-style contribution grid. It measures its container and shows as
 * many weeks as fit — a year on desktop, a few months on a phone — so it never
 * needs to scroll sideways. It knows nothing about streaks: it renders levels.
 */
export function ActivityCalendar({
  today,
  levels,
  weekStartsOn,
  describe,
  label,
}: ActivityCalendarProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)
  const [hovered, setHovered] = useState<{
    date: DateKey
    x: number
    y: number
  } | null>(null)

  useLayoutEffect(() => {
    const element = containerRef.current
    if (!element) return
    setWidth(element.clientWidth)
    const observer = new ResizeObserver(() => setWidth(element.clientWidth))
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  const weeks = Math.max(
    MIN_WEEKS,
    Math.min(
      MAX_WEEKS,
      Math.floor((width - LABEL_COLUMN + GAP) / (CELL + GAP)),
    ),
  )
  const columns = useMemo(
    () => buildCalendar({ today, weeks, weekStartsOn }),
    [today, weeks, weekStartsOn],
  )

  function handlePointerOver(event: PointerEvent<HTMLDivElement>) {
    const target = (event.target as HTMLElement).closest<HTMLElement>(
      '[data-date]',
    )
    const container = containerRef.current
    if (!target || !container) return
    const cell = target.getBoundingClientRect()
    const box = container.getBoundingClientRect()
    setHovered({
      date: target.dataset.date as DateKey,
      x: cell.left - box.left + cell.width / 2,
      y: cell.top - box.top,
    })
  }

  return (
    <div
      ref={containerRef}
      className="relative"
      onPointerLeave={() => setHovered(null)}
    >
      {width > 0 && (
        <div
          role="img"
          aria-label={label}
          onPointerOver={handlePointerOver}
          className="grid"
          style={{
            gridTemplateColumns: `${LABEL_COLUMN - GAP}px repeat(${weeks}, minmax(0, 1fr))`,
            gridTemplateRows: 'auto repeat(7, auto)',
            gap: GAP,
          }}
        >
          {columns.map((column, columnIndex) => (
            <span
              key={`month-${column.cells[0].date}`}
              aria-hidden="true"
              className="h-4 overflow-visible text-[11px] leading-4 whitespace-nowrap text-fg-subtle"
              style={{ gridColumn: columnIndex + 2, gridRow: 1 }}
            >
              {column.monthLabel}
            </span>
          ))}

          {columns[0].cells.map((cell, rowIndex) => {
            const weekday = dayOfWeek(cell.date)
            // Label Mon / Wed / Fri, like GitHub.
            const show = weekday === 1 || weekday === 3 || weekday === 5
            return (
              <span
                key={`weekday-${weekday}`}
                aria-hidden="true"
                className="flex items-center text-[11px] leading-none text-fg-subtle"
                style={{ gridColumn: 1, gridRow: rowIndex + 2 }}
              >
                {show && formatDateKey(cell.date, { weekday: 'short' })}
              </span>
            )
          })}

          {columns.flatMap((column, columnIndex) =>
            column.cells.map((cell, rowIndex) => {
              if (cell.isFuture) return null
              const level = levels.get(cell.date) ?? 0
              return (
                <motion.span
                  key={cell.date}
                  data-date={cell.date}
                  aria-hidden="true"
                  initial={false}
                  animate={
                    cell.isToday && level > 0
                      ? { scale: [1, 1.6, 1] }
                      : { scale: 1 }
                  }
                  transition={{ duration: 0.55, delay: 0.25 }}
                  className={cn(
                    'aspect-square w-full rounded-[3px] transition-colors duration-500',
                    cell.isToday && 'ring-1 ring-fg/70 ring-offset-0',
                  )}
                  style={{
                    gridColumn: columnIndex + 2,
                    gridRow: rowIndex + 2,
                    backgroundColor: LEVEL_COLORS[level],
                  }}
                />
              )
            }),
          )}
        </div>
      )}

      {hovered && (
        <div
          role="presentation"
          className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-lg glass-strong px-2.5 py-1.5 text-xs whitespace-nowrap text-fg"
          style={{
            left: Math.min(Math.max(hovered.x, 80), width - 80),
            top: hovered.y - 6,
          }}
        >
          {describe(hovered.date, levels.get(hovered.date) ?? 0)}
        </div>
      )}
    </div>
  )
}

/** "Less ▢▢▢▢▢ More" legend. */
export function CalendarLegend({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        'flex items-center gap-1 text-[11px] text-fg-subtle',
        className,
      )}
    >
      <span className="mr-1">Less</span>
      {CALENDAR_LEVELS.map((level) => (
        <span
          key={level}
          className="size-[11px] rounded-[3px]"
          style={{ backgroundColor: LEVEL_COLORS[level] }}
        />
      ))}
      <span className="ml-1">More</span>
    </div>
  )
}
