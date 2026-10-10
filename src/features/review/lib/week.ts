import {
  addDays,
  dayOfWeek,
  isDateKey,
  localDay,
  type DateKey,
  type Weekday,
} from '@/lib/date'

/**
 * A week in numbers, worked out on this device: focus, check-ins, habits,
 * tasks finished and log lines. Pure, so the review and what an AI
 * write-up is sent are exactly what's tested.
 */

export interface WeekInput {
  /** The Monday the week starts on. */
  start: DateKey
  today: DateKey
  sessions: ReadonlyArray<{
    day: DateKey
    subjectId: string | null
    durationMs: number
    deletedAt?: string | null
  }>
  /** Days checked in. */
  checkIns: readonly DateKey[]
  habits: ReadonlyArray<{
    id: string
    name: string
    weekdays: readonly Weekday[]
    createdAt: string
  }>
  /** The days each habit was done, by habit id. */
  habitDays: ReadonlyMap<string, ReadonlySet<DateKey>>
  tasks: ReadonlyArray<{
    title: string
    status: string
    due: DateKey | null
    completedAt: string | null
    subjectId: string | null
    deletedAt?: string | null
  }>
  log: ReadonlyArray<{ day: DateKey; text: string }>
  goals: ReadonlyArray<{
    title: string
    milestones: ReadonlyArray<{ title: string; doneAt: string | null }>
  }>
  /** Subject names by id. */
  subjects: ReadonlyMap<string, string>
}

export interface WeekSummary {
  start: DateKey
  end: DateKey
  /** The week's days, Monday first. */
  days: DateKey[]
  /** The days so far (all seven once the week is over). */
  daysSoFar: number
  focus: {
    minutes: number
    sessions: number
    /** Minutes each day, Monday first. */
    byDay: number[]
    /** Most first; "" for no subject. */
    bySubject: Array<{ name: string; minutes: number }>
    /** The week before, to compare. */
    previousMinutes: number
  }
  /** Days checked in. */
  checkIns: number
  /** Scheduled days done, of those due so far (as each habit's own rate counts). */
  habits: Array<{ name: string; done: number; due: number }>
  tasksDone: Array<{ title: string; day: DateKey; subject: string }>
  /** Tasks due during the week that are still open. */
  stillOpen: Array<{ title: string; due: DateKey }>
  log: Array<{ day: DateKey; text: string }>
  milestones: Array<{ goal: string; title: string; day: DateKey }>
  /** Nothing at all happened. */
  empty: boolean
}

const minutes = (ms: number) => Math.round(ms / 60_000)

const scheduled = (day: DateKey, weekdays: readonly Weekday[]) =>
  weekdays.length === 0 ||
  weekdays.length === 7 ||
  weekdays.includes(dayOfWeek(day))

export function summarizeWeek(input: WeekInput): WeekSummary {
  const { start, today } = input
  const days = Array.from({ length: 7 }, (_, index) => addDays(start, index))
  const end = days[6]
  const inWeek = (day: DateKey) => day >= start && day <= end
  const sofar = days.filter((day) => day <= today)
  const name = (id: string | null) => (id && input.subjects.get(id)) || ''

  const byDay = days.map(() => 0)
  const bySubject = new Map<string, number>()
  let sessions = 0
  let previousMs = 0
  const previousStart = addDays(start, -7)
  for (const session of input.sessions) {
    if (session.deletedAt) continue
    if (inWeek(session.day)) {
      sessions++
      byDay[days.indexOf(session.day)] += session.durationMs
      const subject = name(session.subjectId)
      bySubject.set(subject, (bySubject.get(subject) ?? 0) + session.durationMs)
    } else if (session.day >= previousStart && session.day < start) {
      previousMs += session.durationMs
    }
  }

  const habits = input.habits.map((habit) => {
    const since = localDay(habit.createdAt)
    const done = input.habitDays.get(habit.id) ?? new Set<DateKey>()
    let due = 0
    let count = 0
    for (const day of sofar) {
      if (day < since || !scheduled(day, habit.weekdays)) continue
      due++
      if (done.has(day)) count++
    }
    return { name: habit.name, done: count, due }
  })

  const tasksDone = input.tasks
    .filter(
      (task) => !task.deletedAt && task.status === 'done' && task.completedAt,
    )
    .map((task) => ({
      title: task.title,
      day: localDay(task.completedAt!),
      subject: name(task.subjectId),
    }))
    .filter((task) => inWeek(task.day))
    .sort((a, b) => a.day.localeCompare(b.day))
  const stillOpen = input.tasks
    .filter(
      (task) =>
        !task.deletedAt &&
        task.status !== 'done' &&
        task.due !== null &&
        inWeek(task.due) &&
        task.due <= today,
    )
    .map((task) => ({ title: task.title, due: task.due! }))
    .sort((a, b) => a.due.localeCompare(b.due))

  const log = input.log
    .filter((entry) => inWeek(entry.day) && entry.text.trim())
    .map((entry) => ({ day: entry.day, text: entry.text.trim() }))
    .sort((a, b) => a.day.localeCompare(b.day))

  const milestones = input.goals
    .flatMap((goal) =>
      goal.milestones.flatMap((milestone) => {
        if (!milestone.doneAt) return []
        const day = localDay(milestone.doneAt)
        return isDateKey(day) && inWeek(day)
          ? [{ goal: goal.title, title: milestone.title, day }]
          : []
      }),
    )
    .sort((a, b) => a.day.localeCompare(b.day))

  const checkIns = input.checkIns.filter(
    (day) => inWeek(day) && day <= today,
  ).length
  const focusMinutes = minutes(byDay.reduce((sum, ms) => sum + ms, 0))

  return {
    start,
    end,
    days,
    daysSoFar: sofar.length,
    focus: {
      minutes: focusMinutes,
      sessions,
      byDay: byDay.map(minutes),
      bySubject: [...bySubject]
        .map(([subject, ms]) => ({ name: subject, minutes: minutes(ms) }))
        .filter((each) => each.minutes > 0)
        .sort((a, b) => b.minutes - a.minutes),
      previousMinutes: minutes(previousMs),
    },
    checkIns,
    habits,
    tasksDone,
    stillOpen,
    log,
    milestones,
    empty:
      sessions === 0 &&
      checkIns === 0 &&
      habits.every((habit) => habit.done === 0) &&
      tasksDone.length === 0 &&
      log.length === 0 &&
      milestones.length === 0,
  }
}
