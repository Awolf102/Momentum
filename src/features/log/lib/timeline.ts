import type { DateKey } from '@/lib/date'

/** A day's focus, ready to show: minutes, sessions and subjects. */
export interface DayFocus {
  minutes: number
  sessions: number
  /** Most minutes first. */
  subjects: readonly { id: string; name: string; color: string }[]
}

export interface TimelineDay {
  day: DateKey
  /** The day's line ('' if none). */
  line: string
  checkedIn: boolean
  focus: DayFocus | null
}

export interface TimelineMonth {
  /** "YYYY-MM" */
  month: string
  days: TimelineDay[]
}

/**
 * Every day with something to show — a line, a check-in or focus time —
 * newest first. Today is always included, so there's somewhere to write.
 * Days after today (only possible from another device's clock) are left out.
 */
export function buildTimeline({
  lines,
  checkIns,
  focus,
  today,
}: {
  lines: ReadonlyMap<DateKey, string>
  checkIns: Iterable<DateKey>
  focus: ReadonlyMap<DateKey, DayFocus>
  today: DateKey
}): TimelineDay[] {
  const checkedIn = new Set(checkIns)
  const days = new Set<DateKey>([today])
  for (const [day, line] of lines) if (line) days.add(day)
  for (const day of checkedIn) days.add(day)
  for (const [day, total] of focus) if (total.minutes > 0) days.add(day)
  return [...days]
    .filter((day) => day <= today)
    .sort((a, b) => (a < b ? 1 : a > b ? -1 : 0))
    .map((day) => ({
      day,
      line: lines.get(day) ?? '',
      checkedIn: checkedIn.has(day),
      focus: focus.get(day) ?? null,
    }))
}

/** Splits a timeline (newest first) into calendar months. */
export function groupByMonth(days: readonly TimelineDay[]): TimelineMonth[] {
  const months: TimelineMonth[] = []
  for (const day of days) {
    const month = day.day.slice(0, 7)
    const last = months.at(-1)
    if (last?.month === month) last.days.push(day)
    else months.push({ month, days: [day] })
  }
  return months
}
