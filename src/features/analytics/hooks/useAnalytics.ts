import { useEffect, useMemo, useState } from 'react'
import {
  cardSettingsStore,
  reviewLogVersion,
  reviewsBetween,
  type CardReview,
} from '@/features/flashcards/stats'
import { focusSessions } from '@/features/focus'
import {
  sortedCheckInDates,
  streakStore,
  summarizeStreak,
} from '@/features/streak'
import { tasks } from '@/features/tasks'
import { useStore } from '@/lib/store'
import { useToday } from '@/lib/useToday'
import { recallBetween, recallByBucket, reviewCounts } from '../lib/cards'
import {
  bestHours,
  focusByBucket,
  focusByHour,
  focusBySubject,
  focusByWeekday,
} from '../lib/focus'
import { periodRange, type Period } from '../lib/period'
import { streakHeights, streakHistory, streakRuns } from '../lib/streaks'
import {
  completionBetween,
  completionByBucket,
  finishedByBucket,
} from '../lib/tasks'

/**
 * Everything the analytics page shows for a period, worked out on this
 * device from what's stored, and kept up to date.
 */
export function useAnalytics(period: Period) {
  const today = useToday()
  const range = useMemo(() => periodRange(period, today), [period, today])
  const sessions = useStore(focusSessions)
  const streak = useStore(streakStore)
  const allTasks = useStore(tasks)
  const logVersion = useStore(reviewLogVersion)
  const { retention } = useStore(cardSettingsStore)

  // The review log isn't held in memory: it's read for the period.
  const [read, setRead] = useState<{
    key: string
    reviews: CardReview[]
  } | null>(null)
  const readKey = `${range.from}:${range.to}:${logVersion}`
  useEffect(() => {
    let live = true
    reviewsBetween(range.from, range.to)
      .catch(() => [] as CardReview[])
      .then((reviews) => {
        if (live) setRead({ key: readKey, reviews })
      })
    return () => {
      live = false
    }
  }, [range.from, range.to, readKey])
  const reviews = read?.key === readKey ? read.reviews : null

  const focus = useMemo(() => {
    const byHour = focusByHour(sessions, range.from, range.to)
    return {
      bySubject: focusBySubject(sessions, range.from, range.to),
      byBucket: focusByBucket(sessions, range.buckets),
      byHour,
      best: bestHours(byHour),
      byWeekday: focusByWeekday(sessions, range.from, range.to),
    }
  }, [sessions, range])

  const streaks = useMemo(() => {
    const dates = sortedCheckInDates(streak).filter((day) => day <= today)
    const runs = streakRuns(dates)
    return {
      summary: summarizeStreak(dates, today),
      heights: streakHeights(runs, range.from, range.to),
      history: streakHistory(runs, range.from, range.to),
    }
  }, [streak, today, range])

  const taskStats = useMemo(
    () => ({
      total: completionBetween(allTasks, range.from, range.to, today),
      byBucket: completionByBucket(allTasks, range.buckets, today),
      finished: finishedByBucket(allTasks, range.buckets),
    }),
    [allTasks, range, today],
  )

  const cards = useMemo(
    () =>
      reviews && {
        total: recallBetween(reviews, range.from, range.to),
        byBucket: recallByBucket(reviews, range.buckets),
        counts: reviewCounts(reviews, range.from, range.to),
        target: retention,
      },
    [reviews, range, retention],
  )

  return { today, range, focus, streaks, tasks: taskStats, cards }
}

export type Analytics = ReturnType<typeof useAnalytics>
