import { CalendarCheckIcon, TrophyIcon } from '@/components/icons'
import { StatTile } from '@/components/StatTile'
import { formatDateKey } from '@/lib/date'
import type { StreakState } from '../hooks/useStreak'

/** The longest-streak and total-days tiles (the page lays them out). */
export function StreakStatTiles({ streak }: { streak: StreakState }) {
  const onBestRun = streak.current > 1 && streak.current === streak.longest
  return (
    <>
      <StatTile
        icon={<TrophyIcon />}
        label="Longest streak"
        value={streak.longest}
        unit={streak.longest === 1 ? 'day' : 'days'}
        hint={onBestRun ? 'Your best run yet' : 'Personal record'}
        highlight={onBestRun}
      />
      <StatTile
        icon={<CalendarCheckIcon />}
        label="Total days"
        value={streak.total}
        unit={streak.total === 1 ? 'day' : 'days'}
        hint={
          streak.firstCheckIn
            ? `Since ${formatDateKey(streak.firstCheckIn, { month: 'short', day: 'numeric', year: 'numeric' })}`
            : 'Your first starts today'
        }
      />
    </>
  )
}
