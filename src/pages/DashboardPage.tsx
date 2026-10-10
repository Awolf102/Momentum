import { IconButton } from '@/components/IconButton'
import { ShareIcon } from '@/components/icons'
import { CalendarCard } from '@/features/calendar'
import { ClimbCard } from '@/features/climb'
import {
  FocusCard,
  FocusTodayTile,
  useFocusCalendarView,
} from '@/features/focus'
import { openShare } from '@/features/share'
import {
  StreakHero,
  StreakStatTiles,
  useStreak,
  useStreakCalendarView,
} from '@/features/streak'
import { weekStartsOn } from '@/lib/locale'

export function DashboardPage() {
  const streak = useStreak()
  // The calendar can shade days by check-ins or by focus minutes.
  const checkInView = useStreakCalendarView(streak)
  const focusView = useFocusCalendarView(streak.today)
  return (
    <div className="flex flex-col items-center gap-4 pt-4 pb-6 sm:gap-5 sm:pt-8">
      <StreakHero
        streak={streak}
        corner={
          <IconButton
            label="Share streak card"
            onClick={openShare}
            className="size-9 text-base text-fg-muted hover:text-fg"
          >
            <ShareIcon />
          </IconButton>
        }
      />
      <div className="flex w-full max-w-3xl flex-col gap-4 sm:gap-5">
        <FocusCard />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
          <StreakStatTiles streak={streak} />
          <FocusTodayTile className="col-span-2 sm:col-span-1" />
        </div>
        <ClimbCard />
        <CalendarCard
          today={streak.today}
          weekStartsOn={weekStartsOn}
          views={[checkInView, focusView]}
        />
      </div>
    </div>
  )
}
