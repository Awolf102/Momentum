import type { DateKey } from '@/lib/date'
import { bucketIndex, type Bucket } from './period'

/** What the card charts need of a rating in the review log. */
export interface ReviewLike {
  day: DateKey
  /** 1 Again, 2 Hard, 3 Good, 4 Easy. */
  rating: number
  /** The card's state before the rating. */
  state: string
  deletedAt?: string | null
}

/**
 * Recall on cards that were due for review (not new or still being
 * learned): remembered (Hard, Good or Easy) of those reviewed. This is the
 * retention the schedule aims for.
 */
export interface Recall {
  reviewed: number
  recalled: number
}

const reviewing = (review: ReviewLike) =>
  !review.deletedAt && review.state === 'review'

export function recallBetween(
  reviews: readonly ReviewLike[],
  from: DateKey,
  to: DateKey,
): Recall {
  const total = { reviewed: 0, recalled: 0 }
  for (const review of reviews) {
    if (!reviewing(review) || review.day < from || review.day > to) continue
    total.reviewed++
    if (review.rating > 1) total.recalled++
  }
  return total
}

export function recallByBucket(
  reviews: readonly ReviewLike[],
  buckets: readonly Bucket[],
): Recall[] {
  const totals = buckets.map(() => ({ reviewed: 0, recalled: 0 }))
  for (const review of reviews) {
    if (!reviewing(review)) continue
    const index = bucketIndex(buckets, review.day)
    if (index < 0) continue
    totals[index].reviewed++
    if (review.rating > 1) totals[index].recalled++
  }
  return totals
}

/** Remembered, of those reviewed (null with none). */
export const recallRate = (total: Recall) =>
  total.reviewed ? total.recalled / total.reviewed : null

export interface ReviewCounts {
  /** Every rating, learning ones too. */
  ratings: number
  /** Again, Hard, Good, Easy. */
  byRating: [number, number, number, number]
  /** Days with any review. */
  days: number
}

export function reviewCounts(
  reviews: readonly ReviewLike[],
  from: DateKey,
  to: DateKey,
): ReviewCounts {
  const byRating: [number, number, number, number] = [0, 0, 0, 0]
  const days = new Set<DateKey>()
  let ratings = 0
  for (const review of reviews) {
    if (review.deletedAt || review.day < from || review.day > to) continue
    if (review.rating < 1 || review.rating > 4) continue
    ratings++
    byRating[review.rating - 1]++
    days.add(review.day)
  }
  return { ratings, byRating, days: days.size }
}
