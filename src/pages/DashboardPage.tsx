import { IconButton } from '@/components/IconButton'
import { ShareIcon } from '@/components/icons'
import { CalendarCard } from '@/features/calendar'
import { ClimbCard } from '@/features/climb'
import {
  FocusCard,
  FocusTodayTile,
  useFocusCalendarView,
} from '@/features/focus'
import { CardsDueCard } from '@/features/flashcards'
import { HabitsCard, useHabitsCalendarView } from '@/features/habits'
import { InboxNotice } from '@/features/inbox'
import { ContinueReading } from '@/features/library'
import { TodayLine } from '@/features/log'
import { RoutinesCard } from '@/features/routines'
import { openShare } from '@/features/share'
import { TasksTodayCard, useTasksCalendarView } from '@/features/tasks'
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
  const tasksView = useTasksCalendarView(streak.today)
  const habitsView = useHabitsCalendarView(streak.today)
  return (
    <div className="flex flex-col items-center gap-4 pt-4 pb-6 sm:gap-5 sm:pt-8">
      <StreakHero
        streak={streak}
        footer={<TodayLine day={streak.today} />}
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
        <InboxNotice />
        <FocusCard />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
          <StreakStatTiles streak={streak} />
          <FocusTodayTile className="col-span-2 sm:col-span-1" />
        </div>
        <TasksTodayCard />
        <ContinueReading />
        <CardsDueCard />
        <HabitsCard />
        <RoutinesCard />
        <ClimbCard />
        <CalendarCard
          today={streak.today}
          weekStartsOn={weekStartsOn}
          views={[checkInView, habitsView, focusView, tasksView]}
        />
      </div>
    </div>
  )
}
