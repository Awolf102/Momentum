/**
 * Calendar-day helpers.
 *
 * Momentum thinks in calendar days in the user's time zone, not timestamps.
 * A day is a `DateKey` string (`YYYY-MM-DD`). Only `toDateKey` reads local
 * time; every other function does pure calendar arithmetic in UTC, so results
 * never shift with daylight-saving changes.
 */

/** A local calendar day formatted as `YYYY-MM-DD`. Sorts chronologically as a string. */
export type DateKey = string

/** Day of the week, 0 = Sunday … 6 = Saturday (same as `Date#getDay`). */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6

const DAY_MS = 86_400_000
const DATE_KEY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/

const pad = (value: number, length = 2) => String(value).padStart(length, '0')

/** The local calendar day that `date` falls on. */
export function toDateKey(date: Date): DateKey {
  return `${pad(date.getFullYear(), 4)}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/**
 * The local calendar day a moment (an ISO timestamp, as records keep) falls
 * on. Not the timestamp's first ten characters: those are the day in UTC,
 * which in Sydney is yesterday until 10 or 11 in the morning.
 */
export function localDay(timestamp: string): DateKey {
  return toDateKey(new Date(timestamp))
}

export function isDateKey(value: unknown): value is DateKey {
  if (typeof value !== 'string') return false
  const match = DATE_KEY_PATTERN.exec(value)
  if (!match) return false
  const [year, month, day] = [
    Number(match[1]),
    Number(match[2]),
    Number(match[3]),
  ]
  const date = new Date(Date.UTC(year, month - 1, day))
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  )
}

/** Whole days since 1970-01-01 for a calendar day. */
function toEpochDay(key: DateKey): number {
  const [year, month, day] = key.split('-').map(Number)
  return Math.round(Date.UTC(year, month - 1, day) / DAY_MS)
}

function fromEpochDay(epochDay: number): DateKey {
  const date = new Date(epochDay * DAY_MS)
  return `${pad(date.getUTCFullYear(), 4)}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`
}

export function addDays(key: DateKey, amount: number): DateKey {
  return fromEpochDay(toEpochDay(key) + amount)
}

/** Number of calendar days from `from` to `to` (positive when `to` is later). */
export function daysBetween(from: DateKey, to: DateKey): number {
  return toEpochDay(to) - toEpochDay(from)
}

export function dayOfWeek(key: DateKey): Weekday {
  return new Date(toEpochDay(key) * DAY_MS).getUTCDay() as Weekday
}

export function startOfWeek(key: DateKey, weekStartsOn: Weekday): DateKey {
  const offset = (dayOfWeek(key) - weekStartsOn + 7) % 7
  return addDays(key, -offset)
}

/** Day of the month, 1–31. */
export function dayOfMonth(key: DateKey): number {
  return Number(key.slice(8, 10))
}

/** Days in a month (`month` 1–12). */
export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate()
}

/** A calendar day from its parts, or `null` if there's no such day. */
export function makeDateKey(
  year: number,
  month: number,
  day: number,
): DateKey | null {
  const key = `${pad(year, 4)}-${pad(month)}-${pad(day)}`
  return isDateKey(key) ? key : null
}

/**
 * Moves by whole months, keeping the day of the month where it exists and
 * using the month's last day where it doesn't (31 Jan + 1 month = 28 Feb).
 * `day` overrides the day kept (a monthly date that started on the 31st
 * stays on the 31st in months that have one).
 */
export function addMonths(
  key: DateKey,
  amount: number,
  day: number = dayOfMonth(key),
): DateKey {
  const [year, month] = key.split('-').map(Number)
  const index = year * 12 + (month - 1) + amount
  const targetYear = Math.floor(index / 12)
  const targetMonth = (index % 12) + 1
  return `${pad(targetYear, 4)}-${pad(targetMonth)}-${pad(Math.min(day, daysInMonth(targetYear, targetMonth)))}`
}

/** Whole months from `from`'s month to `to`'s month. */
export function monthsBetween(from: DateKey, to: DateKey): number {
  const [fromYear, fromMonth] = from.split('-').map(Number)
  const [toYear, toMonth] = to.split('-').map(Number)
  return (toYear - fromYear) * 12 + (toMonth - fromMonth)
}

const formatters = new Map<string, Intl.DateTimeFormat>()

/** Formats a calendar day with `Intl`, independent of the user's time zone. */
export function formatDateKey(
  key: DateKey,
  options: Intl.DateTimeFormatOptions,
  locale?: string,
): string {
  const cacheKey = `${locale ?? ''}|${JSON.stringify(options)}`
  let formatter = formatters.get(cacheKey)
  if (!formatter) {
    formatter = new Intl.DateTimeFormat(locale, { ...options, timeZone: 'UTC' })
    formatters.set(cacheKey, formatter)
  }
  return formatter.format(new Date(toEpochDay(key) * DAY_MS))
}

/** Milliseconds from `now` until the next local midnight. */
export function msUntilNextDay(now: Date = new Date()): number {
  const midnight = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + 1,
  )
  return midnight.getTime() - now.getTime()
}

type LocaleWithWeekInfo = Intl.Locale & {
  getWeekInfo?: () => { firstDay: number }
  weekInfo?: { firstDay: number }
}

/** First day of the week for a locale (Sunday in the US, Monday in Australia). */
export function getLocaleWeekStart(locale?: string): Weekday {
  try {
    const tag =
      locale ?? (typeof navigator === 'undefined' ? 'en' : navigator.language)
    const intlLocale = new Intl.Locale(tag) as LocaleWithWeekInfo
    // `firstDay` uses ISO numbering: 1 = Monday … 7 = Sunday.
    const firstDay =
      intlLocale.getWeekInfo?.().firstDay ?? intlLocale.weekInfo?.firstDay
    if (firstDay) return (firstDay % 7) as Weekday
  } catch {
    // Older browsers without week info fall through to the ISO default.
  }
  return 1
}
