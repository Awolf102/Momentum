import type { StreakSummary } from '../types'

const days = (count: number) => `${count} ${count === 1 ? 'day' : 'days'}`

/** The sentence under the streak number. */
export function describeStreak({
  status,
  current,
  previous,
}: StreakSummary): string {
  switch (status) {
    case 'new':
      return 'Every streak starts with a single day. Make today day one.'
    case 'done':
      return current === 1
        ? 'You showed up for yourself today. Day one is done.'
        : `You've shown up for yourself ${days(current)} in a row.`
    case 'pending':
      return `Check in today to keep your ${current}-day streak alive.`
    case 'broken':
      return previous > 1
        ? `You built a ${previous}-day streak before. Today is a fresh start.`
        : 'Pick up where you left off. Make today day one.'
  }
}
