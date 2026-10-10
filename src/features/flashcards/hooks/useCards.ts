import { useMemo } from 'react'
import { useStore } from '@/lib/store'
import { useClock } from '@/lib/useClock'
import { cards } from '../cards'
import { dueCounts, nextDue, type DueCounts } from '../lib/queue'
import { cardSettingsStore } from '../settings'
import type { FlashCard } from '../types'

export function useCards(): readonly FlashCard[] {
  return useStore(cards)
}

/** What's left to study today (all, or one subject's), kept current. */
export function useDue(subjectId?: string | null): {
  counts: DueCounts
  next: Date | null
  now: Date
} {
  const all = useCards()
  const now = useClock()
  const { newPerDay } = useStore(cardSettingsStore)
  return useMemo(
    () => ({
      counts: dueCounts(all, { now, newPerDay, subjectId }),
      next: nextDue(all, { now, subjectId }),
      now,
    }),
    [all, now, newPerDay, subjectId],
  )
}
