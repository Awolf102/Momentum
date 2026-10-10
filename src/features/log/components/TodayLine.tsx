import type { DateKey } from '@/lib/date'
import { useLogLines } from '../hooks/useLog'
import { DayLine } from './DayLine'

/** Today's line, under the check-in on the dashboard. */
export function TodayLine({ day }: { day: DateKey }) {
  const line = useLogLines().get(day) ?? ''
  return (
    <DayLine
      day={day}
      line={line}
      emptyLabel="Add a line about today"
      placeholder="What did you do today?"
      align="center"
      className="max-w-sm"
      // Your own words, quieter than the day's message above them.
      textClassName="text-fg-muted hover:text-fg"
    />
  )
}
