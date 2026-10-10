import { useMemo } from 'react'
import { TimerIcon } from '@/components/icons'
import { StatTile } from '@/components/StatTile'
import { findSubject } from '@/features/subjects'
import { useStore } from '@/lib/store'
import { useToday } from '@/lib/useToday'
import { EMPTY_DAY, totalsByDay } from '../lib/stats'
import { focusSessions } from '../sessions'

/** Focus minutes and sessions so far today, beside the streak tiles. */
export function FocusTodayTile({ className }: { className?: string }) {
  const sessions = useStore(focusSessions)
  const today = useToday()
  const total = useMemo(
    () => totalsByDay(sessions).get(today) ?? EMPTY_DAY,
    [sessions, today],
  )
  const subjects = [...total.bySubject]
    .sort((a, b) => b[1] - a[1])
    .map(([id]) => findSubject(id)?.name)
    .filter(Boolean)
  const hint =
    total.sessions === 0
      ? 'No sessions yet'
      : `${total.sessions} ${total.sessions === 1 ? 'session' : 'sessions'}${subjects.length ? ` · ${subjects.join(', ')}` : ''}`
  return (
    <StatTile
      className={className}
      icon={<TimerIcon />}
      label="Focus today"
      value={total.minutes}
      unit="min"
      hint={hint}
    />
  )
}
