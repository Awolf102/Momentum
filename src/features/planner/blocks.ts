import { createCollection } from '@/lib/collection'
import { isDateKey } from '@/lib/date'
import { isRecord } from '@/lib/guards'
import { DAY_MINUTES, MIN_BLOCK } from './lib/time'
import type { Block, BlockKind } from './types'

const KINDS: readonly BlockKind[] = ['task', 'focus', 'other']
export const MAX_BLOCK_TITLE = 200

/** A block read back from storage or a backup; its times kept within the day. */
export function parseBlock(value: unknown): Block | null {
  if (!isRecord(value)) return null
  const { id, createdAt, updatedAt, day, start, end } = value
  if (
    typeof id !== 'string' ||
    typeof createdAt !== 'string' ||
    typeof updatedAt !== 'string' ||
    !isDateKey(day) ||
    typeof start !== 'number' ||
    typeof end !== 'number' ||
    !Number.isFinite(start) ||
    !Number.isFinite(end)
  )
    return null
  const from = Math.min(DAY_MINUTES - MIN_BLOCK, Math.max(0, Math.round(start)))
  const kind = KINDS.includes(value.kind as BlockKind)
    ? (value.kind as BlockKind)
    : 'other'
  const taskId = typeof value.taskId === 'string' ? value.taskId : null
  return {
    id,
    day,
    start: from,
    end: Math.min(DAY_MINUTES, Math.max(from + MIN_BLOCK, Math.round(end))),
    // A task block without its task is an ordinary block.
    kind: kind === 'task' && !taskId ? 'other' : kind,
    title:
      typeof value.title === 'string'
        ? value.title.trim().slice(0, MAX_BLOCK_TITLE)
        : '',
    taskId: kind === 'task' ? taskId : null,
    subjectId: typeof value.subjectId === 'string' ? value.subjectId : null,
    createdAt,
    updatedAt,
    deletedAt: typeof value.deletedAt === 'string' ? value.deletedAt : null,
  }
}

/** Time set aside on the plan, one record per block. */
export const blocks = createCollection<Block>({
  name: 'blocks',
  parse: parseBlock,
})
