import type { DateKey } from '@/lib/date'
import { DAILY_MESSAGES, MILESTONE_MESSAGES } from './messages'

/** FNV-1a: a tiny, stable string hash. */
function hash(value: string): number {
  let result = 0x811c9dc5
  for (let index = 0; index < value.length; index++) {
    result ^= value.charCodeAt(index)
    result = Math.imul(result, 0x01000193)
  }
  return result >>> 0
}

/**
 * The motivational line for a check-in. Milestones get a special message;
 * otherwise the pick is deterministic per day, so reloading shows the same line.
 */
export function getMotivation({
  streak,
  date,
}: {
  streak: number
  date: DateKey
}): string {
  return (
    MILESTONE_MESSAGES[streak] ??
    DAILY_MESSAGES[hash(date) % DAILY_MESSAGES.length]
  )
}
