export { StreakHero } from './components/StreakHero'
export { StreakStatTiles } from './components/StreakStats'
export { useStreak, type StreakState } from './hooks/useStreak'
export { useStreakCalendarView } from './hooks/useStreakCalendarView'
export {
  checkIn,
  isCheckedIn,
  mergeCheckIns,
  onCheckIn,
  resetStreak,
  streakStore,
} from './store'
export { describeStreak } from './lib/copy'
export { FLAME_INNER, FLAME_OUTER, FLAME_VIEWBOX } from './lib/flame'
export type { StreakData, StreakStatus, StreakSummary } from './types'
