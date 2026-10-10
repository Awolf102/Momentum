import { GlassCard } from '@/components/GlassCard'
import { SegmentedControl } from '@/components/SegmentedControl'
import type { DateKey, Weekday } from '@/lib/date'
import { useStore } from '@/lib/store'
import { calendarViewStore, setCalendarView } from '../store'
import { ActivityCalendar, CalendarLegend } from './ActivityCalendar'

/**
 * One way of shading the calendar. The calendar knows nothing about what the
 * levels mean: each feature that has something to show supplies a view.
 */
export interface CalendarView {
  id: string
  /** Short name for the switch. */
  label: string
  levels: ReadonlyMap<DateKey, number>
  describe: (date: DateKey, level: number) => string
  /** One line, e.g. "99 check-ins in the past year". */
  summary: string
  /** What brighter days mean in this view. */
  note: string
}

interface CalendarCardProps {
  today: DateKey
  weekStartsOn: Weekday
  views: readonly CalendarView[]
}

/** The activity calendar card, with a switch between views. */
export function CalendarCard({
  today,
  weekStartsOn,
  views,
}: CalendarCardProps) {
  const { view: chosen } = useStore(calendarViewStore)
  const view = views.find((candidate) => candidate.id === chosen) ?? views[0]
  return (
    <GlassCard className="w-full px-5 py-5 sm:px-6 sm:py-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
        <div>
          <h2 className="text-[15px] font-semibold tracking-tight">Activity</h2>
          <p className="mt-0.5 text-xs text-fg-subtle">{view.summary}</p>
        </div>
        {views.length > 1 && (
          <div className="w-full sm:w-auto sm:min-w-56">
            <SegmentedControl
              label="Calendar view"
              value={view.id}
              options={views.map((option) => ({
                value: option.id,
                label: option.label,
              }))}
              onChange={setCalendarView}
            />
          </div>
        )}
      </div>
      <ActivityCalendar
        today={today}
        levels={view.levels}
        weekStartsOn={weekStartsOn}
        describe={view.describe}
        label={`Activity calendar, ${view.label.toLowerCase()}: ${view.summary}.`}
      />
      <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11px] text-fg-subtle">{view.note}</p>
        <CalendarLegend />
      </div>
    </GlassCard>
  )
}
