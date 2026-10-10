import {
  addDays,
  dayOfMonth,
  formatDateKey,
  startOfWeek,
  type DateKey,
  type Weekday,
} from '@/lib/date'

export interface CalendarCell {
  date: DateKey
  isToday: boolean
  isFuture: boolean
}

export interface CalendarColumn {
  /** Seven days, starting on `weekStartsOn`. */
  cells: CalendarCell[]
  /** Short month name when this column is the first week of a month. */
  monthLabel: string | null
}

export interface BuildCalendarOptions {
  today: DateKey
  /** Number of week columns; the last one contains today. */
  weeks: number
  weekStartsOn: Weekday
  locale?: string
}

/** Minimum columns between month labels so they never overlap. */
const MIN_LABEL_GAP = 3

export function buildCalendar({
  today,
  weeks,
  weekStartsOn,
  locale,
}: BuildCalendarOptions): CalendarColumn[] {
  const firstWeekStart = addDays(
    startOfWeek(today, weekStartsOn),
    -(weeks - 1) * 7,
  )
  const columns: CalendarColumn[] = []
  let lastLabelIndex = -Infinity

  for (let week = 0; week < weeks; week++) {
    const weekStart = addDays(firstWeekStart, week * 7)
    const cells = Array.from({ length: 7 }, (_, day): CalendarCell => {
      const date = addDays(weekStart, day)
      return { date, isToday: date === today, isFuture: date > today }
    })

    // Label the column that contains the 1st of a month.
    const firstOfMonth = cells.find((cell) => dayOfMonth(cell.date) === 1)
    let monthLabel: string | null = null
    if (firstOfMonth && week - lastLabelIndex >= MIN_LABEL_GAP) {
      monthLabel = formatDateKey(firstOfMonth.date, { month: 'short' }, locale)
      lastLabelIndex = week
    }

    columns.push({ cells, monthLabel })
  }

  // Label the first column too when there's room before the next label.
  const nextLabel = columns.findIndex((column) => column.monthLabel !== null)
  if (columns.length > 0 && (nextLabel === -1 || nextLabel >= MIN_LABEL_GAP)) {
    columns[0].monthLabel ??= formatDateKey(
      columns[0].cells[0].date,
      { month: 'short' },
      locale,
    )
  }

  return columns
}
