// Wall-clock times in a named time zone, turned into moments and back with
// Intl (no time zone data of our own).

/** Outlook writes Windows names for zones; these are the ones a student meets. */
const WINDOWS_ZONES: Record<string, string> = {
  'AUS Eastern Standard Time': 'Australia/Sydney',
  'E. Australia Standard Time': 'Australia/Brisbane',
  'Cen. Australia Standard Time': 'Australia/Adelaide',
  'AUS Central Standard Time': 'Australia/Darwin',
  'W. Australia Standard Time': 'Australia/Perth',
  'Tasmania Standard Time': 'Australia/Hobart',
  'New Zealand Standard Time': 'Pacific/Auckland',
  'GMT Standard Time': 'Europe/London',
  'Greenwich Standard Time': 'Atlantic/Reykjavik',
  'W. Europe Standard Time': 'Europe/Berlin',
  'Romance Standard Time': 'Europe/Paris',
  'Central Europe Standard Time': 'Europe/Budapest',
  'Central European Standard Time': 'Europe/Warsaw',
  'E. Europe Standard Time': 'Europe/Chisinau',
  'FLE Standard Time': 'Europe/Kiev',
  'GTB Standard Time': 'Europe/Bucharest',
  'Russian Standard Time': 'Europe/Moscow',
  'Eastern Standard Time': 'America/New_York',
  'Central Standard Time': 'America/Chicago',
  'Mountain Standard Time': 'America/Denver',
  'US Mountain Standard Time': 'America/Phoenix',
  'Pacific Standard Time': 'America/Los_Angeles',
  'Alaskan Standard Time': 'America/Anchorage',
  'Hawaiian Standard Time': 'Pacific/Honolulu',
  'Atlantic Standard Time': 'America/Halifax',
  'Canada Central Standard Time': 'America/Regina',
  'SA Pacific Standard Time': 'America/Bogota',
  'E. South America Standard Time': 'America/Sao_Paulo',
  'Argentina Standard Time': 'America/Buenos_Aires',
  'India Standard Time': 'Asia/Kolkata',
  'Singapore Standard Time': 'Asia/Singapore',
  'China Standard Time': 'Asia/Shanghai',
  'Taipei Standard Time': 'Asia/Taipei',
  'Tokyo Standard Time': 'Asia/Tokyo',
  'Korea Standard Time': 'Asia/Seoul',
  'SE Asia Standard Time': 'Asia/Bangkok',
  'Arabian Standard Time': 'Asia/Dubai',
  'Israel Standard Time': 'Asia/Jerusalem',
  'South Africa Standard Time': 'Africa/Johannesburg',
  'Egypt Standard Time': 'Africa/Cairo',
  UTC: 'UTC',
  'Coordinated Universal Time': 'UTC',
}

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

function isKnownZone(zone: string): boolean {
  try {
    formatter(zone)
    return true
  } catch {
    return false
  }
}

/**
 * An IANA zone for a TZID as calendars write it: an IANA name, a Windows
 * name (Outlook), or one with a vendor prefix ("/mozilla.org/…/Australia/
 * Sydney"). Null when it can't be told, and the time is read as local.
 */
export function resolveZone(tzid: string | undefined): string | null {
  if (!tzid) return null
  const name = tzid.trim().replace(/^"|"$/g, '')
  if (!name) return null
  const windows = WINDOWS_ZONES[name]
  if (windows) return windows
  if (/^(utc|gmt|z)$/i.test(name)) return 'UTC'
  if (isKnownZone(name)) return name
  // A known zone at the end of a longer name.
  const parts = name.split('/')
  for (let start = 1; start < parts.length - 1; start++) {
    const tail = parts.slice(start).join('/')
    if (isKnownZone(tail)) return tail
  }
  return null
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
