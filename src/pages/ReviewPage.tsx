import { useSearch } from 'wouter'
import { WeekReview, weekOf } from '@/features/review/page'
import { isDateKey } from '@/lib/date'
import { useToday } from '@/lib/useToday'

export default function ReviewPage() {
  const today = useToday()
  const wanted = new URLSearchParams(useSearch()).get('week')
  // Any day of a week (or none: this week), never one still to come.
  const week = weekOf(isDateKey(wanted) && wanted <= today ? wanted : today)
  return <WeekReview key={week} week={week} />
}
