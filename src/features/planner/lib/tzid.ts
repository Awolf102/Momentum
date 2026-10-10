// Time zones as calendar files name them, read only when importing one.
import { isKnownZone } from './zones'

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
