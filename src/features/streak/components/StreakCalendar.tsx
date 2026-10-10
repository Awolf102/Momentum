import { useMemo } from 'react'
import { GlassCard } from '@/components/GlassCard'
import { ActivityCalendar, CalendarLegend } from '@/features/calendar'
import { addDays, formatDateKey, type DateKey } from '@/lib/date'
import { weekStartsOn } from '@/lib/locale'
import type { StreakState } from '../hooks/useStreak'
import { depthToLevel, streakDepths } from '../lib/streak'

/** The activity calendar, with brighter cells the deeper a day is into a streak. */
export function StreakCalendar({ streak }: { streak: StreakState }) {
  const { dates, today } = streak
  const depths = useMemo(() => streakDepths(dates), [dates])
  const levels = useMemo(
    () =>
      new Map([...depths].map(([date, depth]) => [date, depthToLevel(depth)])),
    [depths],
  )
  const yearAgo = addDays(today, -364)
  const pastYear = dates.filter(
    (date) => date >= yearAgo && date <= today,
  ).length

  function describe(date: DateKey) {
    const day = formatDateKey(date, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
    const depth = depths.get(date)
    if (!depth) return `${day} · No check-in`
    return depth === 1
      ? `${day} · Checked in`
      : `${day} · Day ${depth} of a streak`
  }

  const summary = `${pastYear} ${pastYear === 1 ? 'check-in' : 'check-ins'} in the past year`

  return (
    <GlassCard className="w-full px-5 py-5 sm:px-6 sm:py-6">
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 className="text-[15px] font-semibold tracking-tight">Activity</h2>
        <p className="text-xs text-fg-subtle">{summary}</p>
      </div>
      <ActivityCalendar
        today={today}
        levels={levels}
        weekStartsOn={weekStartsOn}
        describe={describe}
        label={`Activity calendar: ${summary}.`}
      />
      <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11px] text-fg-subtle">
          Brighter days are deeper into a streak.
        </p>
        <CalendarLegend />
      </div>
    </GlassCard>
  )
}
