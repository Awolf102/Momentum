import { IconButton } from '@/components/IconButton'
import { ShareIcon } from '@/components/icons'
import { ClimbCard } from '@/features/climb'
import { openShare } from '@/features/share'
import {
  StreakCalendar,
  StreakHero,
  StreakStats,
  useStreak,
} from '@/features/streak'

export function DashboardPage() {
  const streak = useStreak()
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
        <ClimbCard />
        <StreakStats streak={streak} />
        <StreakCalendar streak={streak} />
      </div>
    </div>
  )
}
