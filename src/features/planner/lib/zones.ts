// Wall-clock times in a named time zone, turned into moments and back with
// Intl (no time zone data of our own).

const formatters = new Map<string, Intl.DateTimeFormat>()

function formatter(zone: string): Intl.DateTimeFormat {
  let found = formatters.get(zone)
  if (!found) {
    found = new Intl.DateTimeFormat('en-US', {
      timeZone: zone,
      hourCycle: 'h23',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
    })
    formatters.set(zone, found)
  }
  return found
}

/** Whether this browser knows a zone by that name. */
export function isKnownZone(zone: string): boolean {
  try {
    formatter(zone)
    return true
  } catch {
    return false
  }
}

/** The zone's offset from UTC at a moment, in minutes (Sydney in summer: 660). */
export function zoneOffset(moment: number, zone: string): number {
  const values: Record<string, number> = {}
  for (const part of formatter(zone).formatToParts(new Date(moment)))
    if (part.type !== 'literal') values[part.type] = Number(part.value)
  const asUtc = Date.UTC(
    values.year,
    values.month - 1,
    values.day,
    values.hour,
    values.minute,
    values.second,
  )
  // Whole minutes: the moment's own seconds and milliseconds drop out.
  return Math.round((asUtc - Math.floor(moment / 1000) * 1000) / 60_000)
}

/**
 * The moment a wall-clock time happens in a zone: `UTC`, an IANA zone, or
 * `null` for this device's own time. A time skipped by a daylight-saving
 * change moves forward by the change, as calendar apps do.
 */
export function zonedMoment(
  date: string,
  minutes: number,
  zone: string | null,
): number {
  const [year, month, day] = date.split('-').map(Number)
  if (zone === null) return new Date(year, month - 1, day, 0, minutes).getTime()
  const wall = Date.UTC(year, month - 1, day, 0, minutes)
  if (zone === 'UTC') return wall
  const first = wall - zoneOffset(wall, zone) * 60_000
  const second = wall - zoneOffset(first, zone) * 60_000
  if (first === second) return first
  // Near a change: take the reading that maps back to the wall time.
  const check = (moment: number) =>
    moment + zoneOffset(moment, zone) * 60_000 === wall
  if (check(second)) return second
  if (check(first)) return first
  return Math.max(first, second)
}
