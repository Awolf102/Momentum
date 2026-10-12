import { isDateKey, type DateKey } from '@/lib/date'
import { isRecord } from '@/lib/guards'
import { createPersistentStore } from '@/lib/persistentStore'
import type { WriteUp } from './lib/writeUp'

/** An AI write-up of a week, kept so it isn't sent for again. */
export interface WrittenReview extends WriteUp {
  /** When it was written. */
  at: string
  /** The reply was cut off at the length limit: this is what came. */
  cutOff?: boolean
}

export interface ReviewData {
  /** Show the week on the dashboard on Sundays (and Mondays, for last week). */
  onSundays: boolean
  /** Write-ups, by the Monday their week starts on. */
  written: Record<DateKey, WrittenReview>
}

const MAX_TEXT = 800

function parseWritten(value: unknown): WrittenReview | null {
  if (!isRecord(value) || typeof value.at !== 'string') return null
  const text = (field: unknown) =>
    typeof field === 'string' ? field.slice(0, MAX_TEXT) : ''
  const written = {
    wentWell: text(value.wentWell),
    slipped: text(value.slipped),
    nextWeek: text(value.nextWeek),
    at: value.at,
    ...(value.cutOff === true ? { cutOff: true } : {}),
  }
  return written.wentWell || written.slipped || written.nextWeek
    ? written
    : null
}

export function parseReview(data: unknown): ReviewData | null {
  if (!isRecord(data)) return null
  const written: Record<DateKey, WrittenReview> = {}
  if (isRecord(data.written)) {
    for (const [week, value] of Object.entries(data.written)) {
      const parsed = isDateKey(week) ? parseWritten(value) : null
      if (parsed) written[week] = parsed
    }
  }
  return {
    onSundays: typeof data.onSundays === 'boolean' ? data.onSundays : true,
    written,
  }
}

/** Restoring a backup keeps write-ups from both sides (the later of two wins), and this device's setting. */
export function mergeReview(
  current: ReviewData,
  incoming: ReviewData,
): ReviewData {
  const written = { ...current.written }
  for (const [week, review] of Object.entries(incoming.written)) {
    const mine = written[week]
    if (!mine || review.at > mine.at) written[week] = review
  }
  return { onSundays: current.onSundays, written }
}

/** The weekly review's setting and the write-ups kept. */
export const reviewStore = createPersistentStore<ReviewData>({
  key: 'momentum.review',
  version: 1,
  defaultValue: { onSundays: true, written: {} },
  parse: parseReview,
  merge: mergeReview,
})

export const setReviewOnSundays = (onSundays: boolean) =>
  reviewStore.set((data) => ({ ...data, onSundays }))

export function saveWriteUp(
  week: DateKey,
  writeUp: WriteUp & { cutOff?: boolean },
  now: Date = new Date(),
): WrittenReview {
  const written = { ...writeUp, at: now.toISOString() }
  reviewStore.set((data) => ({
    ...data,
    written: { ...data.written, [week]: written },
  }))
  return written
}

export function forgetWriteUp(week: DateKey): void {
  reviewStore.set((data) => {
    const written = { ...data.written }
    delete written[week]
    return { ...data, written }
  })
}
