import { createCollection } from '@/lib/collection'
import { isDateKey, toDateKey, type DateKey } from '@/lib/date'
import { isRecord } from '@/lib/guards'
import { routinesStore } from './store'
import type { RoutineRun } from './types'

export const runId = (routineId: string, day: DateKey) => `${routineId}:${day}`

export function parseRun(value: unknown): RoutineRun | null {
  if (!isRecord(value)) return null
  const { id, routineId, day, done, completedAt, createdAt, updatedAt } = value
  if (typeof routineId !== 'string' || !isDateKey(day)) return null
  if (id !== runId(routineId, day) || typeof updatedAt !== 'string') return null
  return {
    id,
    routineId,
    day,
    done: Array.isArray(done)
      ? [
          ...new Set(
            done.filter((step): step is string => typeof step === 'string'),
          ),
        ]
      : [],
    completedAt: typeof completedAt === 'string' ? completedAt : null,
    createdAt: typeof createdAt === 'string' ? createdAt : updatedAt,
    updatedAt,
    deletedAt: typeof value.deletedAt === 'string' ? value.deletedAt : null,
  }
}

/** Each day's run through each routine. */
export const routineRuns = createCollection<RoutineRun>({
  name: 'routineRuns',
  parse: parseRun,
})

/**
 * Ticks a step on (or off) for a day. Ticking the last one completes the
 * routine for the day; unticking any reopens it.
 */
export async function toggleStep(
  routineId: string,
  stepId: string,
  day: DateKey = toDateKey(new Date()),
  now: Date = new Date(),
): Promise<void> {
  const routine = routinesStore
    .get()
    .routines.find((item) => item.id === routineId)
  if (!routine) return
  const id = runId(routineId, day)
  const existing = routineRuns.find(id)
  const live = existing && !existing.deletedAt ? existing : undefined
  const done = new Set(live?.done ?? [])
  if (done.has(stepId)) done.delete(stepId)
  else done.add(stepId)
  const complete =
    routine.steps.length > 0 && routine.steps.every((step) => done.has(step.id))
  const stamp = now.toISOString()
  await routineRuns.put({
    id,
    routineId,
    day,
    done: [...done],
    completedAt: complete ? (live?.completedAt ?? stamp) : null,
    createdAt: existing?.createdAt ?? stamp,
    updatedAt: stamp,
    deletedAt: null,
  })
}
