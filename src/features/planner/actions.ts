import { createId } from '@/lib/id'
import { blocks, MAX_BLOCK_TITLE } from './blocks'
import { CALENDAR_COLORS, calendars, MAX_CALENDAR_NAME } from './calendars'
import { IcsError, parseIcs, type ParsedCalendar } from './lib/ics'
import { DAY_MINUTES, MIN_BLOCK } from './lib/time'
import type { Block, Calendar, CalendarColor } from './types'

export type NewBlock = Pick<Block, 'day' | 'start' | 'end' | 'kind'> &
  Partial<Pick<Block, 'title' | 'taskId' | 'subjectId'>>

/** Keeps a block's times within the day and at least a quarter hour long. */
function within(start: number, end: number): { start: number; end: number } {
  const from = Math.min(DAY_MINUTES - MIN_BLOCK, Math.max(0, Math.round(start)))
  return {
    start: from,
    end: Math.min(DAY_MINUTES, Math.max(from + MIN_BLOCK, Math.round(end))),
  }
}

export async function addBlock(
  fields: NewBlock,
  now: Date = new Date(),
): Promise<Block> {
  const stamp = now.toISOString()
  const block: Block = {
    id: createId(),
    day: fields.day,
    ...within(fields.start, fields.end),
    kind: fields.kind,
    title: (fields.title ?? '').trim().slice(0, MAX_BLOCK_TITLE),
    taskId: fields.kind === 'task' ? (fields.taskId ?? null) : null,
    subjectId: fields.subjectId ?? null,
    createdAt: stamp,
    updatedAt: stamp,
    deletedAt: null,
  }
  await blocks.add(block)
  return block
}

export type BlockChanges = Partial<
  Pick<Block, 'day' | 'start' | 'end' | 'title' | 'subjectId'>
>

export async function updateBlock(
  id: string,
  changes: BlockChanges,
  now: Date = new Date(),
): Promise<void> {
  const block = blocks.find(id)
  if (!block || block.deletedAt) return
  const next = { ...block, ...changes }
  await blocks.put({
    ...next,
    ...within(next.start, next.end),
    title: next.title.trim().slice(0, MAX_BLOCK_TITLE),
    updatedAt: now.toISOString(),
  })
}

export async function removeBlock(id: string, now?: Date): Promise<void> {
  await blocks.remove(id, now)
}

/** Undo for `removeBlock`. */
export async function restoreBlock(
  id: string,
  now: Date = new Date(),
): Promise<void> {
  const block = blocks.find(id)
  if (!block?.deletedAt) return
  await blocks.put({ ...block, deletedAt: null, updatedAt: now.toISOString() })
}

/** The biggest calendar file read (a busy timetable is well under 1 MB). */
export const MAX_ICS_BYTES = 5 * 1024 * 1024

export interface ImportResult {
  calendar: Calendar
  parsed: ParsedCalendar
}

/** A colour no calendar has yet, if there is one. */
function freeColor(): CalendarColor {
  const used = new Set(calendars.get().map((calendar) => calendar.color))
  return CALENDAR_COLORS.find((color) => !used.has(color)) ?? CALENDAR_COLORS[0]
}

const nameFrom = (fileName: string) =>
  fileName.replace(/\.(ics|ical|ifb|icalendar)$/i, '').trim() || 'Calendar'

/**
 * Reads an .ics file into a calendar: a new one, or `replacing` one already
 * imported (its name, colour and visibility kept). Nothing leaves the device.
 */
export async function importCalendar(
  file: File,
  replacing?: Calendar,
  now: Date = new Date(),
): Promise<ImportResult> {
  if (file.size > MAX_ICS_BYTES)
    throw new IcsError('That file is too big for a calendar (over 5 MB).')
  const parsed = parseIcs(await file.text())
  if (parsed.events.length === 0)
    throw new IcsError('There are no events in that calendar.')
  const stamp = now.toISOString()
  const calendar: Calendar = replacing
    ? {
        ...replacing,
        fileName: file.name,
        importedAt: stamp,
        events: parsed.events,
        updatedAt: stamp,
      }
    : {
        id: createId(),
        name: (parsed.name ?? nameFrom(file.name)).slice(0, MAX_CALENDAR_NAME),
        color: freeColor(),
        hidden: false,
        fileName: file.name,
        importedAt: stamp,
        events: parsed.events,
        createdAt: stamp,
        updatedAt: stamp,
        deletedAt: null,
      }
  if (replacing) await calendars.put(calendar)
  else await calendars.add(calendar)
  return { calendar, parsed }
}

export async function updateCalendar(
  id: string,
  changes: Partial<Pick<Calendar, 'name' | 'color' | 'hidden'>>,
  now: Date = new Date(),
): Promise<void> {
  const calendar = calendars.find(id)
  if (!calendar || calendar.deletedAt) return
  const name =
    changes.name === undefined
      ? calendar.name
      : changes.name.trim().slice(0, MAX_CALENDAR_NAME) || calendar.name
  await calendars.put({
    ...calendar,
    ...changes,
    name,
    updatedAt: now.toISOString(),
  })
}

export async function removeCalendar(id: string, now?: Date): Promise<void> {
  await calendars.remove(id, now)
}

/** Undo for `removeCalendar`. */
export async function restoreCalendar(
  id: string,
  now: Date = new Date(),
): Promise<void> {
  const calendar = calendars.find(id)
  if (!calendar?.deletedAt) return
  await calendars.put({
    ...calendar,
    deletedAt: null,
    updatedAt: now.toISOString(),
  })
}
