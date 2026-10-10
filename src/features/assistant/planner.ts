import { focusSessions } from '@/features/focus'
import {
  describeSchedule,
  habitCheckIns,
  habitsStore,
  liveHabits,
  summarizeHabit,
} from '@/features/habits'
import { logEntries } from '@/features/log'
import {
  liveRoutines,
  PART_NAMES,
  routineRuns,
  routinesStore,
} from '@/features/routines'
import {
  sortedCheckInDates,
  streakStore,
  summarizeStreak,
} from '@/features/streak'
import { subjectsStore } from '@/features/subjects'
import { tasks } from '@/features/tasks'
import {
  addDays,
  dayOfWeek,
  getLocaleWeekStart,
  localDay,
  toDateKey,
  type DateKey,
  type Weekday,
} from '@/lib/date'
import type { SnapshotData } from './lib/snapshot'

const scheduled = (day: DateKey, weekdays: readonly Weekday[]) =>
  weekdays.length === 0 || weekdays.includes(dayOfWeek(day))

/** Everything the planning snapshot can describe, as it is now. */
export function gatherSnapshotData(now: Date = new Date()): SnapshotData {
  const today = toDateKey(now)
  const subjects = new Map(
    subjectsStore.get().subjects.map((subject) => [subject.id, subject.name]),
  )
  const subjectName = (id: string | null) => (id && subjects.get(id)) || ''

  const streak = summarizeStreak(sortedCheckInDates(streakStore.get()), today)

  const checkIns = new Map<string, Set<DateKey>>()
  for (const record of habitCheckIns.get()) {
    const days = checkIns.get(record.habitId) ?? new Set<DateKey>()
    days.add(record.day)
    checkIns.set(record.habitId, days)
  }
  const habits = liveHabits(habitsStore.get()).map((habit) => {
    const summary = summarizeHabit(
      checkIns.get(habit.id) ?? new Set(),
      today,
      habit.weekdays,
      localDay(habit.createdAt),
    )
    return {
      name: habit.name,
      schedule: describeSchedule(habit.weekdays),
      current: summary.current,
      longest: summary.longest,
      rate: summary.rate,
      dueToday: summary.dueToday,
      doneToday: summary.doneToday,
    }
  })

  const runs = new Map(routineRuns.get().map((run) => [run.id, run]))
  const routines = liveRoutines(routinesStore.get()).map((routine) => {
    let due = 0
    let done = 0
    for (let back = 0; back < 7; back++) {
      const day = addDays(today, -back)
      if (!scheduled(day, routine.weekdays)) continue
      due++
      if (runs.get(`${routine.id}:${day}`)?.completedAt) done++
    }
    return {
      name: routine.name,
      part: PART_NAMES[routine.part].toLowerCase(),
      steps: routine.steps.length,
      due,
      done,
    }
  })

  const focus = new Map<
    DateKey,
    { minutes: number; bySubject: Map<string, number> }
  >()
  for (const session of focusSessions.get()) {
    const day = focus.get(session.day) ?? { minutes: 0, bySubject: new Map() }
    const minutes = session.durationMs / 60_000
    day.minutes += minutes
    const subject = subjectName(session.subjectId)
    day.bySubject.set(subject, (day.bySubject.get(subject) ?? 0) + minutes)
    focus.set(session.day, day)
  }
  for (const day of focus.values()) {
    day.minutes = Math.round(day.minutes)
    for (const [subject, minutes] of day.bySubject)
      day.bySubject.set(subject, Math.round(minutes))
  }

  return {
    today,
    weekStartsOn: getLocaleWeekStart(),
    streak: {
      current: streak.current,
      longest: streak.longest,
      checkedInToday: streak.checkedInToday,
    },
    tasks: tasks.get().map((task) => ({
      title: task.title,
      status: task.status,
      due: task.due,
      time: task.time,
      priority: task.priority,
      subject: subjectName(task.subjectId),
      repeats: task.recurrence !== null,
      doneOn: task.completedAt ? toDateKey(new Date(task.completedAt)) : null,
    })),
    habits,
    routines,
    focus,
    log: logEntries
      .get()
      .map((entry) => ({ day: entry.day, text: entry.text })),
  }
}
