import type { DateKey } from '@/lib/date'

export interface CheckIn {
  /** ISO timestamp of the moment the user checked in. */
  at: string
}

/** Persisted streak history: at most one check-in per local calendar day. */
export interface StreakData {
  checkIns: Record<DateKey, CheckIn>
}

export type StreakStatus =
  /** Never checked in. */
  | 'new'
  /** Checked in today. */
  | 'done'
  /** Checked in yesterday; today is still open, so the streak is alive. */
  | 'pending'
  /** A full calendar day passed without a check-in. */
  | 'broken'

export interface StreakSummary {
  status: StreakStatus
  /** Consecutive days ending today (or yesterday, while `pending`). */
  current: number
  longest: number
  total: number
  checkedInToday: boolean
  firstCheckIn: DateKey | null
  lastCheckIn: DateKey | null
  /** Length of the streak that just ended, when `broken`. */
  previous: number
}
