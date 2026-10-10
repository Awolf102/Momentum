const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

const tenths = (value: number) => {
  const rounded = Math.round(value * 10) / 10
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1)
}

/** How long until a card is due again, shortly: "10 min", "3 days", "1.5 mo". */
export function describeInterval(ms: number): string {
  if (ms < HOUR) return `${Math.max(1, Math.round(ms / MINUTE))} min`
  if (ms < DAY) return `${Math.round(ms / HOUR)} h`
  const days = Math.round(ms / DAY)
  if (days < 31) return days === 1 ? '1 day' : `${days} days`
  if (days < 365) return `${tenths(days / 30.4)} mo`
  return `${tenths(days / 365)} yr`
}

/** When something is next due, from now: "in 10 min", "tomorrow", "in 3 days". */
export function describeWhen(due: Date, now: Date): string {
  const ms = due.getTime() - now.getTime()
  if (ms <= 0) return 'now'
  const startOfToday = new Date(now)
  startOfToday.setHours(0, 0, 0, 0)
  // Calendar days apart (rounded, as a day across a clock change isn't 24 h).
  const days = Math.round(
    (new Date(due).setHours(0, 0, 0, 0) - startOfToday.getTime()) / DAY,
  )
  if (days === 0) return `in ${describeInterval(ms)}`
  if (days === 1) return 'tomorrow'
  return `in ${days} days`
}
