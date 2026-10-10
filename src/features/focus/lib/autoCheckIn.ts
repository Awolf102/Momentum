import type { DateKey } from '@/lib/date'

/**
 * Finishing the first full focus session of a day checks the user in. Each
 * day is considered once: later sessions that day never check in again, even
 * if the check-in was made by hand or since removed.
 */
export function shouldAutoCheckIn(
  day: DateKey,
  lastConsidered: DateKey | null,
): boolean {
  return lastConsidered === null || day > lastConsidered
}
