import type { DateKey } from '@/lib/date'
import type { FocusSession } from '../types'

export interface DayTotal {
  minutes: number
  sessions: number
  /** Minutes per subject id ('' for no subject). */
  bySubject: Map<string, number>
}

const MINUTE = 60_000

/** Focus per day, keyed by the day each session started. */
export function totalsByDay(
  sessions: readonly FocusSession[],
): Map<DateKey, DayTotal> {
  const ms = new Map<
    DateKey,
    { ms: number; sessions: number; bySubject: Map<string, number> }
  >()
  for (const session of sessions) {
    if (session.deletedAt) continue
    const day = ms.get(session.day) ?? {
      ms: 0,
      sessions: 0,
      bySubject: new Map(),
    }
    day.ms += session.durationMs
    day.sessions += 1
    const subject = session.subjectId ?? ''
    day.bySubject.set(
      subject,
      (day.bySubject.get(subject) ?? 0) + session.durationMs,
    )
    ms.set(session.day, day)
  }
  return new Map(
    [...ms].map(([day, total]) => [
      day,
      {
        minutes: Math.round(total.ms / MINUTE),
        sessions: total.sessions,
        bySubject: new Map(
          [...total.bySubject].map(([subject, value]) => [
            subject,
            Math.round(value / MINUTE),
          ]),
        ),
      },
    ]),
  )
}

export const EMPTY_DAY: DayTotal = {
  minutes: 0,
  sessions: 0,
  bySubject: new Map(),
}

/** Minutes at which a day reaches each calendar level (1–4). */
export const FOCUS_LEVEL_MINUTES = [1, 50, 100, 150] as const

/** A calendar level for a day's focus: two sessions, four, six… */
export function focusLevel(minutes: number): number {
  let level = 0
  for (const threshold of FOCUS_LEVEL_MINUTES) if (minutes >= threshold) level++
  return level
}

export function focusLevels(
  totals: ReadonlyMap<DateKey, DayTotal>,
): Map<DateKey, number> {
  return new Map(
    [...totals]
      .filter(([, total]) => total.minutes > 0)
      .map(([day, total]) => [day, focusLevel(total.minutes)]),
  )
}

export { formatMinutes } from '@/lib/duration'
