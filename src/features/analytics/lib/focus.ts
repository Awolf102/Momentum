import { dayOfWeek, type DateKey } from '@/lib/date'
import { bucketIndex, type Bucket } from './period'

/** What the focus charts need of a session. */
export interface SessionLike {
  day: DateKey
  startedAt: string
  endedAt: string
  /** Time focused (pauses left out). */
  durationMs: number
  subjectId: string | null
  deletedAt?: string | null
}

const MINUTE = 60_000
const HOUR = 60 * MINUTE

const counted = (
  sessions: readonly SessionLike[],
  from: DateKey,
  to: DateKey,
) =>
  sessions.filter(
    (session) =>
      !session.deletedAt &&
      session.durationMs > 0 &&
      session.day >= from &&
      session.day <= to,
  )

export interface SubjectTotal {
  /** null for sessions without a subject. */
  subjectId: string | null
  minutes: number
  sessions: number
}

/** Focus per subject over the days from `from` to `to`, most first. */
export function focusBySubject(
  sessions: readonly SessionLike[],
  from: DateKey,
  to: DateKey,
): SubjectTotal[] {
  const totals = new Map<string, { ms: number; sessions: number }>()
  for (const session of counted(sessions, from, to)) {
    const key = session.subjectId ?? ''
    const total = totals.get(key) ?? { ms: 0, sessions: 0 }
    total.ms += session.durationMs
    total.sessions++
    totals.set(key, total)
  }
  return [...totals]
    .map(([key, total]) => ({
      subjectId: key || null,
      minutes: Math.round(total.ms / MINUTE),
      sessions: total.sessions,
    }))
    .filter((total) => total.minutes > 0)
    .sort(
      (a, b) =>
        b.minutes - a.minutes ||
        (a.subjectId ?? '￿').localeCompare(b.subjectId ?? '￿'),
    )
}

export interface BucketFocus {
  minutes: number
  /** Minutes per subject id ('' for none). */
  bySubject: Map<string, number>
}

/** Focus in each column, by subject. */
export function focusByBucket(
  sessions: readonly SessionLike[],
  buckets: readonly Bucket[],
): BucketFocus[] {
  const ms = buckets.map(() => new Map<string, number>())
  if (buckets.length)
    for (const session of counted(
      sessions,
      buckets[0].start,
      buckets[buckets.length - 1].end,
    )) {
      const index = bucketIndex(buckets, session.day)
      if (index < 0) continue
      const key = session.subjectId ?? ''
      ms[index].set(key, (ms[index].get(key) ?? 0) + session.durationMs)
    }
  return ms.map((bySubject) => {
    const total = [...bySubject.values()].reduce((sum, each) => sum + each, 0)
    return {
      minutes: Math.round(total / MINUTE),
      bySubject: new Map(
        [...bySubject].map(([key, value]) => [key, Math.round(value / MINUTE)]),
      ),
    }
  })
}

/**
 * Minutes of focus in each hour of the day (0–23). A session's focused
 * time is spread over the hours it ran, in this device's time, so one from
 * 9:50 to 10:20 counts a third at 9 and two thirds at 10.
 */
export function focusByHour(
  sessions: readonly SessionLike[],
  from: DateKey,
  to: DateKey,
): number[] {
  const hours = Array.from({ length: 24 }, () => 0)
  for (const session of counted(sessions, from, to)) {
    const start = Date.parse(session.startedAt)
    const parsedEnd = Date.parse(session.endedAt)
    if (!Number.isFinite(start)) continue
    const end =
      Number.isFinite(parsedEnd) && parsedEnd > start
        ? parsedEnd
        : start + session.durationMs
    const span = end - start
    let at = start
    while (at < end) {
      const date = new Date(at)
      let next = new Date(
        date.getFullYear(),
        date.getMonth(),
        date.getDate(),
        date.getHours() + 1,
      ).getTime()
      // An hour repeated when the clocks go back can't send it backwards.
      if (next <= at) next = at + HOUR
      const slice = Math.min(next, end) - at
      hours[date.getHours()] += ((slice / span) * session.durationMs) / MINUTE
      at = Math.min(next, end)
    }
  }
  return hours.map((minutes) => Math.round(minutes * 10) / 10)
}

export interface BestHours {
  /** The first hour (0–23) and the hour after the last. */
  start: number
  end: number
  minutes: number
  /** Of all the focus, 0–1. */
  share: number
}

/**
 * The run of `width` hours (wrapping past midnight) with the most focus, or
 * null with none. Ties go to the earlier run.
 */
export function bestHours(
  byHour: readonly number[],
  width = 2,
): BestHours | null {
  const total = byHour.reduce((sum, minutes) => sum + minutes, 0)
  if (total <= 0) return null
  let best = { start: 0, minutes: -1 }
  for (let start = 0; start < 24; start++) {
    let minutes = 0
    for (let offset = 0; offset < width; offset++)
      minutes += byHour[(start + offset) % 24]
    if (minutes > best.minutes + 1e-9) best = { start, minutes }
  }
  return {
    start: best.start,
    end: (best.start + width) % 24,
    minutes: Math.round(best.minutes),
    share: best.minutes / total,
  }
}

/** Minutes of focus on each weekday, Monday first. */
export function focusByWeekday(
  sessions: readonly SessionLike[],
  from: DateKey,
  to: DateKey,
): number[] {
  const ms = Array.from({ length: 7 }, () => 0)
  for (const session of counted(sessions, from, to))
    ms[(dayOfWeek(session.day) + 6) % 7] += session.durationMs
  return ms.map((value) => Math.round(value / MINUTE))
}
