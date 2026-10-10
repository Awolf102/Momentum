import { addDays, dayOfWeek, type DateKey } from '@/lib/date'
import { formatMinutes } from '@/lib/duration'
import type { PlannerPart } from '../types'

/**
 * A plain-text snapshot of your plans for the planning assistant: only the
 * parts you chose to share. Pure, so what's sent is exactly what's tested.
 */

export interface SnapshotTask {
  title: string
  status: 'todo' | 'doing' | 'done'
  due: DateKey | null
  time: string | null
  priority: 0 | 1 | 2 | 3
  subject: string
  repeats: boolean
  /** The day it was finished. */
  doneOn: DateKey | null
}

export interface SnapshotHabit {
  name: string
  schedule: string
  current: number
  longest: number
  /** Share of due days done in the last four weeks. */
  rate: number | null
  dueToday: boolean
  doneToday: boolean
}

export interface SnapshotRoutine {
  name: string
  part: string
  steps: number
  /** Due days in the last week, and how many were finished. */
  due: number
  done: number
}

export interface SnapshotData {
  today: DateKey
  /** The first day of the week where you live (0 Sunday … 6 Saturday). */
  weekStartsOn: number
  streak: { current: number; longest: number; checkedInToday: boolean }
  tasks: readonly SnapshotTask[]
  habits: readonly SnapshotHabit[]
  routines: readonly SnapshotRoutine[]
  /** Minutes of focus per day, and per subject that day. */
  focus: ReadonlyMap<
    DateKey,
    { minutes: number; bySubject: ReadonlyMap<string, number> }
  >
  log: ReadonlyArray<{ day: DateKey; text: string }>
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
]
const PRIORITIES = ['', 'low priority', 'medium priority', 'high priority']

/** "Fri 9 Oct", the same everywhere (it's read by a model, not shown). */
export function dayName(day: DateKey): string {
  const [, month, date] = day.split('-').map(Number)
  return `${WEEKDAYS[dayOfWeek(day)]} ${date} ${MONTHS[month - 1]}`
}

/** Open tasks listed, at most; the rest are counted. */
const MAX_TASKS = 40
const LOG_DAYS = 14

function describeTask(task: SnapshotTask, withDay: boolean): string {
  const details = [
    withDay && task.due ? dayName(task.due) : '',
    task.time ?? '',
    task.subject,
    PRIORITIES[task.priority],
    task.status === 'doing' ? 'in progress' : '',
    task.repeats ? 'repeats' : '',
  ].filter(Boolean)
  return `- ${task.title}${details.length ? ` (${details.join(', ')})` : ''}`
}

function tasksPart(data: SnapshotData): string[] {
  const { today } = data
  const open = data.tasks
    .filter((task) => task.status !== 'done')
    .sort(
      (a, b) =>
        (a.due ?? '9999').localeCompare(b.due ?? '9999') ||
        (a.time ?? '').localeCompare(b.time ?? '') ||
        b.priority - a.priority,
    )
  const weekEnd = addDays(today, 7)
  const groups: Array<[string, SnapshotTask[], boolean]> = [
    ['Overdue', open.filter((task) => task.due && task.due < today), true],
    ['Due today', open.filter((task) => task.due === today), false],
    [
      'Due in the next 7 days',
      open.filter(
        (task) => task.due && task.due > today && task.due <= weekEnd,
      ),
      true,
    ],
    ['Later', open.filter((task) => task.due && task.due > weekEnd), true],
    ['No date', open.filter((task) => !task.due), false],
  ]
  const lines = [`Tasks (${open.length} open)`]
  let listed = 0
  for (const [name, tasks, withDay] of groups) {
    if (tasks.length === 0) continue
    lines.push(`${name}:`)
    for (const task of tasks) {
      if (listed >= MAX_TASKS) break
      lines.push(describeTask(task, withDay))
      listed++
    }
  }
  if (open.length > listed) lines.push(`(and ${open.length - listed} more)`)
  if (open.length === 0) lines.push('Nothing open.')
  const weekAgo = addDays(today, -6)
  const done = data.tasks.filter(
    (task) => task.doneOn && task.doneOn >= weekAgo && task.doneOn <= today,
  )
  if (done.length)
    lines.push(
      `Finished in the last 7 days: ${done.length} (${done
        .slice(0, 8)
        .map((task) => task.title)
        .join('; ')}${done.length > 8 ? '; …' : ''})`,
    )
  return lines
}

function habitsPart(data: SnapshotData): string[] {
  if (data.habits.length === 0) return ['Habits', 'None set up.']
  return [
    'Habits',
    ...data.habits.map((habit) => {
      const today = habit.doneToday
        ? 'done today'
        : habit.dueToday
          ? 'due today, not done yet'
          : 'not due today'
      const rate =
        habit.rate === null
          ? ''
          : `; ${Math.round(habit.rate * 100)}% of due days in the last 4 weeks`
      return `- ${habit.name} (${habit.schedule}): ${today}; current run ${habit.current}, longest ${habit.longest}${rate}`
    }),
  ]
}

function routinesPart(data: SnapshotData): string[] {
  if (data.routines.length === 0) return ['Routines', 'None set up.']
  return [
    'Routines',
    ...data.routines.map(
      (routine) =>
        `- ${routine.name} (${routine.part}, ${routine.steps} steps): finished ${routine.done} of ${routine.due} due days in the last week`,
    ),
  ]
}

function sumFocus(data: SnapshotData, from: DateKey, to: DateKey) {
  let minutes = 0
  const bySubject = new Map<string, number>()
  for (let day = from; day <= to; day = addDays(day, 1)) {
    const total = data.focus.get(day)
    if (!total) continue
    minutes += total.minutes
    for (const [subject, value] of total.bySubject)
      bySubject.set(subject, (bySubject.get(subject) ?? 0) + value)
  }
  return { minutes, bySubject }
}

function describeFocus({
  minutes,
  bySubject,
}: ReturnType<typeof sumFocus>): string {
  if (minutes === 0) return 'none'
  const subjects = [...bySubject]
    .filter(([, value]) => value > 0)
    .sort((a, b) => b[1] - a[1])
    .map(
      ([subject, value]) =>
        `${subject || 'no subject'} ${formatMinutes(value)}`,
    )
  return `${formatMinutes(minutes)}${subjects.length ? ` (${subjects.join(', ')})` : ''}`
}

function focusPart(data: SnapshotData): string[] {
  const { today } = data
  const back = (dayOfWeek(today) - data.weekStartsOn + 7) % 7
  const weekStart = addDays(today, -back)
  const lastWeekStart = addDays(weekStart, -7)
  return [
    'Focus time',
    `- Today: ${describeFocus(sumFocus(data, today, today))}`,
    `- This week (since ${dayName(weekStart)}): ${describeFocus(sumFocus(data, weekStart, today))}`,
    `- Last week: ${describeFocus(sumFocus(data, lastWeekStart, addDays(weekStart, -1)))}`,
  ]
}

function logPart(data: SnapshotData): string[] {
  const since = addDays(data.today, -(LOG_DAYS - 1))
  const lines = data.log
    .filter(
      (entry) =>
        entry.day >= since && entry.day <= data.today && entry.text.trim(),
    )
    .sort((a, b) => b.day.localeCompare(a.day))
    .map((entry) => `- ${dayName(entry.day)}: ${entry.text.trim()}`)
  return [
    `Daily log (last ${LOG_DAYS} days)`,
    ...(lines.length ? lines : ['Nothing written.']),
  ]
}

/** The snapshot, with only the chosen parts. */
export function plannerSnapshot(
  data: SnapshotData,
  parts: ReadonlySet<PlannerPart>,
): string {
  const { streak } = data
  const sections: string[][] = [
    [
      `Today: ${dayName(data.today)}.`,
      `Daily streak: ${streak.current} ${streak.current === 1 ? 'day' : 'days'} (${streak.checkedInToday ? 'checked in today' : 'not checked in yet today'}); longest ${streak.longest}.`,
    ],
  ]
  if (parts.has('tasks')) sections.push(tasksPart(data))
  if (parts.has('habits')) sections.push(habitsPart(data))
  if (parts.has('routines')) sections.push(routinesPart(data))
  if (parts.has('focus')) sections.push(focusPart(data))
  if (parts.has('log')) sections.push(logPart(data))
  return sections.map((lines) => lines.join('\n')).join('\n\n')
}
