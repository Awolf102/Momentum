import { createCollection } from '@/lib/collection'
import { isDateKey } from '@/lib/date'
import { isRecord } from '@/lib/guards'
import type { FocusSession } from './types'

export function parseSession(value: unknown): FocusSession | null {
  if (!isRecord(value)) return null
  const {
    id,
    subjectId,
    startedAt,
    endedAt,
    durationMs,
    pausedMs,
    day,
    createdAt,
    updatedAt,
    deletedAt,
  } = value
  if (typeof id !== 'string' || !isDateKey(day)) return null
  if (typeof startedAt !== 'string' || typeof endedAt !== 'string') return null
  if (
    typeof durationMs !== 'number' ||
    !Number.isFinite(durationMs) ||
    durationMs < 0
  )
    return null
  return {
    id,
    subjectId: typeof subjectId === 'string' ? subjectId : null,
    startedAt,
    endedAt,
    durationMs,
    pausedMs: typeof pausedMs === 'number' && pausedMs >= 0 ? pausedMs : 0,
    day,
    createdAt: typeof createdAt === 'string' ? createdAt : endedAt,
    updatedAt: typeof updatedAt === 'string' ? updatedAt : endedAt,
    deletedAt: typeof deletedAt === 'string' ? deletedAt : null,
  }
}

/** Every finished focus session, one record each, in IndexedDB. */
export const focusSessions = createCollection<FocusSession>({
  name: 'focusSessions',
  parse: parseSession,
})
