import { useSearch } from 'wouter'
import { AnalyticsView, PERIODS, type Period } from '@/features/analytics/page'

export default function AnalyticsPage() {
  const wanted = new URLSearchParams(useSearch()).get('period')
  const period = PERIODS.includes(wanted as Period)
    ? (wanted as Period)
    : 'month'
  return <AnalyticsView period={period} />
}
