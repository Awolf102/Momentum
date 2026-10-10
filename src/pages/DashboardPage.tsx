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
      <StreakHero streak={streak} />
      <div className="flex w-full max-w-3xl flex-col gap-4 sm:gap-5">
        <StreakStats streak={streak} />
        <StreakCalendar streak={streak} />
      </div>
    </div>
  )
}
