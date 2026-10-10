import { useMemo } from 'react'
import { focusSessions } from '@/features/focus'
import { SUBJECT_COLORS, subjectsStore } from '@/features/subjects'
import { tasks, type Task } from '@/features/tasks'
import { addDays, type DateKey } from '@/lib/date'
import { useStore } from '@/lib/store'
import { blocks } from '../blocks'
import { calendars } from '../calendars'
import { FOCUS_SWATCH, OTHER_SWATCH, TASK_SWATCH } from '../lib/colors'
import { eventsOnDay, type EventOnDay } from '../lib/day'
import { DAY_MINUTES, parseClock } from '../lib/time'
import { zonedMoment } from '../lib/zones'
import type { Block } from '../types'

/** A focus session that ran on the day, in minutes on it. */
export interface SessionOnDay {
  id: string
  start: number
  end: number
  color: string
  subject: string | null
}

/** A task due at a time on the day, not yet given a block. */
export interface TaskMark {
  id: string
  title: string
  minutes: number
}

export interface PlanDay {
  blocks: Block[]
  events: EventOnDay[]
  allDay: EventOnDay[]
  sessions: SessionOnDay[]
  marks: TaskMark[]
  /** Not done, not on this day's plan yet: overdue, due then, or undated. */
  toPlan: Task[]
  /** What a block is called: its task's title, or its own. */
  titleOf: (block: Block) => string
  /** Its subject's colour, or one for its kind. */
  colorOf: (block: Block) => string
  subjectName: (id: string | null) => string | null
  task: (id: string | null) => Task | undefined
  calendarCount: number
}

const minutesOn = (iso: string, dayStart: number, dayEnd: number) => {
  const moment = Date.parse(iso)
  if (moment <= dayStart) return 0
  if (moment >= dayEnd) return DAY_MINUTES
  const date = new Date(moment)
  return date.getHours() * 60 + date.getMinutes()
}

/** Everything the plan shows for a day, kept up to date. */
export function usePlanDay(day: DateKey): PlanDay {
  const allBlocks = useStore(blocks)
  const allCalendars = useStore(calendars)
  const allSessions = useStore(focusSessions)
  const allTasks = useStore(tasks)
  const subjectData = useStore(subjectsStore)

  return useMemo(() => {
    const subjects = new Map(
      subjectData.subjects.map((subject) => [subject.id, subject]),
    )
    const taskById = new Map(allTasks.map((task) => [task.id, task]))
    const dayBlocks = allBlocks
      .filter((block) => block.day === day)
      .sort((a, b) => a.start - b.start || a.end - b.end)
    const found = eventsOnDay(allCalendars, day)

    const dayStart = zonedMoment(day, 0, null)
    const dayEnd = zonedMoment(addDays(day, 1), 0, null)
    const sessions = allSessions.flatMap((session): SessionOnDay[] => {
      const started = Date.parse(session.startedAt)
      const ended = Date.parse(session.endedAt)
      if (!(started < dayEnd && ended > dayStart)) return []
      const subject = session.subjectId
        ? subjects.get(session.subjectId)
        : undefined
      return [
        {
          id: session.id,
          start: minutesOn(session.startedAt, dayStart, dayEnd),
          end: minutesOn(session.endedAt, dayStart, dayEnd),
          color: subject ? SUBJECT_COLORS[subject.color] : OTHER_SWATCH,
          subject: subject?.name ?? null,
        },
      ]
    })

    const planned = new Set(dayBlocks.map((block) => block.taskId))
    const open = allTasks.filter(
      (task) => task.status !== 'done' && !planned.has(task.id),
    )
    const rank = (task: Task) =>
      task.due === null ? 2 : task.due < day ? 0 : 1
    const toPlan = open
      .filter((task) => task.due === null || task.due <= day)
      .sort(
        (a, b) =>
          rank(a) - rank(b) ||
          (a.due ?? '').localeCompare(b.due ?? '') ||
          (a.time ?? '99').localeCompare(b.time ?? '99') ||
          b.priority - a.priority ||
          a.order - b.order,
      )
    const marks = open.flatMap((task): TaskMark[] => {
      const minutes = task.due === day ? parseClock(task.time) : null
      return minutes === null
        ? []
        : [{ id: task.id, title: task.title, minutes }]
    })

    const titleOf = (block: Block) =>
      (block.taskId ? taskById.get(block.taskId)?.title : null) ||
      block.title ||
      (block.kind === 'focus'
        ? block.subjectId && subjects.get(block.subjectId)
          ? `Focus: ${subjects.get(block.subjectId)!.name}`
          : 'Focus'
        : 'Untitled block')
    const colorOf = (block: Block) => {
      const subject = block.subjectId
        ? subjects.get(block.subjectId)
        : undefined
      if (subject) return SUBJECT_COLORS[subject.color]
      return block.kind === 'task'
        ? TASK_SWATCH
        : block.kind === 'focus'
          ? FOCUS_SWATCH
          : OTHER_SWATCH
    }
    return {
      blocks: dayBlocks,
      events: found.filter((event) => !event.allDay),
      allDay: found.filter((event) => event.allDay),
      sessions,
      marks,
      toPlan,
      titleOf,
      colorOf,
      subjectName: (id) => (id ? (subjects.get(id)?.name ?? null) : null),
      task: (id) => (id ? taskById.get(id) : undefined),
      calendarCount: allCalendars.length,
    }
  }, [day, allBlocks, allCalendars, allSessions, allTasks, subjectData])
}
