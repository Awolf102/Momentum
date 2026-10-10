import type { ReactNode } from 'react'
import { GlassCard } from '@/components/GlassCard'
import { CalendarCheckIcon, TrophyIcon } from '@/components/icons'
import { cn } from '@/lib/cn'
import { formatDateKey } from '@/lib/date'
import type { StreakState } from '../hooks/useStreak'

export function StreakStats({ streak }: { streak: StreakState }) {
  const onBestRun = streak.current > 1 && streak.current === streak.longest

  return (
    <div className="grid w-full grid-cols-2 gap-3 sm:gap-4">
      <StatTile
        icon={<TrophyIcon />}
        label="Longest streak"
        value={streak.longest}
        hint={onBestRun ? 'Your best run yet' : 'Personal record'}
        highlight={onBestRun}
      />
      <StatTile
        icon={<CalendarCheckIcon />}
        label="Total days"
        value={streak.total}
        hint={
          streak.firstCheckIn
            ? `Since ${formatDateKey(streak.firstCheckIn, { month: 'short', day: 'numeric', year: 'numeric' })}`
            : 'Your first starts today'
        }
      />
    </div>
  )
}

interface StatTileProps {
  icon: ReactNode
  label: string
  value: number
  hint: string
  highlight?: boolean
}

function StatTile({
  icon,
  label,
  value,
  hint,
  highlight = false,
}: StatTileProps) {
  return (
    <GlassCard className="px-5 py-4 sm:px-6 sm:py-5">
      <p className="flex items-center gap-2 text-[11px] font-semibold tracking-[0.12em] whitespace-nowrap text-fg-subtle uppercase sm:tracking-[0.18em]">
        <span
          className={cn(
            'hidden text-sm sm:inline',
            highlight ? 'text-orange-300 light:text-orange-500' : '',
          )}
        >
          {icon}
        </span>
        {label}
      </p>
      <p className="mt-2 flex items-baseline gap-1.5">
        <span className="font-serif text-5xl leading-none tabular-nums">
          {value}
        </span>
        <span className="text-sm text-fg-muted">
          {value === 1 ? 'day' : 'days'}
        </span>
      </p>
      <p
        className={cn(
          'mt-2 truncate text-xs',
          highlight
            ? 'text-orange-200 light:text-orange-600'
            : 'text-fg-subtle',
        )}
      >
        {hint}
      </p>
    </GlassCard>
  )
}
