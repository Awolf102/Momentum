/** Minutes in a day: the plan's times run from 0 to this. */
export const DAY_MINUTES = 24 * 60
/** Blocks move and stretch in steps of this many minutes. */
export const STEP = 15
/** The shortest block. */
export const MIN_BLOCK = 15

export function clampMinutes(minutes: number): number {
  return Math.min(DAY_MINUTES, Math.max(0, minutes))
}

/** To the nearest step (or up to the next one). */
export function snap(minutes: number, step = STEP, up = false): number {
  return clampMinutes(
    (up ? Math.ceil(minutes / step) : Math.round(minutes / step)) * step,
  )
}

const clocks = new Map<string, Intl.DateTimeFormat>()

/** A time of day in the user's style: "9:30 am", "21:30". 24:00 is midnight. */
export function formatClock(minutes: number, locale?: string): string {
  const key = locale ?? ''
  let format = clocks.get(key)
  if (!format) {
    format = new Intl.DateTimeFormat(locale, {
      hour: 'numeric',
      minute: '2-digit',
      timeZone: 'UTC',
    })
    clocks.set(key, format)
  }
  return format.format(new Date(Date.UTC(2000, 0, 1, 0, minutes % DAY_MINUTES)))
}

/** An hour's label on the timeline: "9 am", "21:00". */
export function formatHour(hour: number, locale?: string): string {
  return new Intl.DateTimeFormat(locale, {
    hour: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(2000, 0, 1, hour % 24)))
}

/** "9:30–11:00 am" style, as two clock times. */
export function formatSpan(
  start: number,
  end: number,
  locale?: string,
): string {
  return `${formatClock(start, locale)}–${formatClock(end, locale)}`
}

/** A length in words: "45 min", "1 h", "1 h 30 min". */
export function formatLength(minutes: number): string {
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  if (!hours) return `${rest} min`
  return rest ? `${hours} h ${rest} min` : `${hours} h`
}

/** "HH:MM" (as tasks keep times) in minutes, or null. */
export function parseClock(value: string | null | undefined): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value ?? '')
  if (!match) return null
  const hours = Number(match[1])
  const minutes = Number(match[2])
  return hours < 24 && minutes < 60 ? hours * 60 + minutes : null
}

interface Span {
  start: number
  end: number
}

/**
 * The first free time of `length` minutes from `from` (rounded up to a step)
 * that overlaps nothing already there, or null if the day has no room left.
 */
export function freeSlot(
  taken: readonly Span[],
  from: number,
  length: number,
): number | null {
  const sorted = [...taken].sort((a, b) => a.start - b.start)
  let start = snap(from, STEP, true)
  for (;;) {
    if (start + length > DAY_MINUTES) return null
    const clash = sorted.find(
      (span) => span.start < start + length && span.end > start,
    )
    if (!clash) return start
    start = snap(Math.max(clash.end, start + STEP), STEP, true)
  }
}
