import { createCollection } from '@/lib/collection'
import { isDateKey, toDateKey, type DateKey } from '@/lib/date'
import { isRecord } from '@/lib/guards'
import type { HabitCheckIn } from './types'

export const checkInId = (habitId: string, day: DateKey) => `${habitId}:${day}`

export function parseHabitCheckIn(value: unknown): HabitCheckIn | null {
  if (!isRecord(value)) return null
  const { id, habitId, day, createdAt, updatedAt, deletedAt } = value
  if (typeof habitId !== 'string' || !isDateKey(day)) return null
  if (id !== checkInId(habitId, day) || typeof updatedAt !== 'string')
    return null
  return {
    id,
    habitId,
    day,
    createdAt: typeof createdAt === 'string' ? createdAt : updatedAt,
    updatedAt,
    deletedAt: typeof deletedAt === 'string' ? deletedAt : null,
  }
}

/** Every day each habit was done, one record per habit per day. */
export const habitCheckIns = createCollection<HabitCheckIn>({
  name: 'habitCheckIns',
  parse: parseHabitCheckIn,
})

export function isDone(habitId: string, day: DateKey): boolean {
  const record = habitCheckIns.find(checkInId(habitId, day))
  return Boolean(record && !record.deletedAt)
}

/**
 * Marks a habit done for a day, or not done if it was. Returns whether it's
 * done now. Undoing keeps a record of the change, so another device's backup
 * can't bring it back.
 */
export async function toggleHabit(
  habitId: string,
  day: DateKey = toDateKey(new Date()),
  now: Date = new Date(),
): Promise<boolean> {
  const id = checkInId(habitId, day)
  if (isDone(habitId, day)) {
    await habitCheckIns.remove(id, now)
    return false
  }
  const stamp = now.toISOString()
  await habitCheckIns.put({
    id,
    habitId,
    day,
    createdAt: habitCheckIns.find(id)?.createdAt ?? stamp,
    updatedAt: stamp,
    deletedAt: null,
  })
  return true
}
