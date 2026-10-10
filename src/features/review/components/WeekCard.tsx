import { lazy, Suspense } from 'react'
import { useStore } from '@/lib/store'
import { useToday } from '@/lib/useToday'
import { reviewWeekToShow, weekOf } from '../lib/weeks'
import { reviewStore } from '../store'

// The glance itself (and the week's numbers) is loaded only on the days
// it shows.
const WeekGlance = lazy(() =>
  import('./WeekGlance').then((module) => ({ default: module.WeekGlance })),
)

/** On the dashboard on Sundays (and Mondays, for last week): the week at a glance. */
export function WeekCard() {
  const today = useToday()
  const { onSundays } = useStore(reviewStore)
  const week = reviewWeekToShow(today)
  if (!onSundays || !week) return null
  return (
    <Suspense fallback={null}>
      <WeekGlance week={week} last={week !== weekOf(today)} />
    </Suspense>
  )
}
