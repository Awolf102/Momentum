import { SUBJECT_COLORS, type SubjectColor } from '@/features/subjects'
import type { Weekday } from '@/lib/date'
import { isRecord } from '@/lib/guards'
import { createId } from '@/lib/id'
import { createPersistentStore } from '@/lib/persistentStore'
import { createStore } from '@/lib/store'
import type { Habit } from './types'

export interface HabitsData {
  habits: Habit[]
}

export const MAX_NAME_LENGTH = 60
const COLORS = Object.keys(SUBJECT_COLORS) as SubjectColor[]

function parseHabit(value: unknown): Habit | null {
  if (!isRecord(value)) return null
  const { id, name, color, weekdays, order, createdAt, updatedAt, deletedAt } =
    value
  if (typeof id !== 'string' || typeof name !== 'string' || !name.trim())
    return null
  if (typeof createdAt !== 'string' || typeof updatedAt !== 'string')
    return null
  return {
    id,
    name: name.trim().slice(0, MAX_NAME_LENGTH),
    color: COLORS.includes(color as SubjectColor)
      ? (color as SubjectColor)
      : 'amber',
    weekdays: Array.isArray(weekdays)
      ? ([
          ...new Set(
            weekdays.filter(
              (day): day is Weekday =>
                Number.isInteger(day) && day >= 0 && day <= 6,
            ),
          ),
        ].sort() as Weekday[])
      : [],
    order: typeof order === 'number' && Number.isFinite(order) ? order : 0,
    createdAt,
    updatedAt,
    deletedAt: typeof deletedAt === 'string' ? deletedAt : null,
  }
}

export function parseHabits(data: unknown): HabitsData | null {
  if (!isRecord(data) || !Array.isArray(data.habits)) return null
  const seen = new Set<string>()
  const habits: Habit[] = []
  for (const value of data.habits) {
    const habit = parseHabit(value)
    if (!habit || seen.has(habit.id)) continue
    seen.add(habit.id)
    habits.push(habit)
  }
  return { habits }
}

/** Restoring a backup keeps habits from both sides; the later edit wins. */
export function mergeHabits(
  current: HabitsData,
  incoming: HabitsData,
): HabitsData {
  const byId = new Map(current.habits.map((habit) => [habit.id, habit]))
  for (const habit of incoming.habits) {
    const mine = byId.get(habit.id)
    if (!mine || habit.updatedAt > mine.updatedAt) byId.set(habit.id, habit)
  }
  return { habits: [...byId.values()] }
}

/** The habits (beyond the daily check-in), as defined. Their days are in `checkIns.ts`. */
export const habitsStore = createPersistentStore<HabitsData>({
  key: 'momentum.habits',
  version: 1,
  defaultValue: { habits: [] },
  parse: parseHabits,
  merge: mergeHabits,
})

export const liveHabits = (data: HabitsData): Habit[] =>
  data.habits
    .filter((habit) => !habit.deletedAt)
    .sort((a, b) => a.order - b.order || (a.createdAt < b.createdAt ? -1 : 1))

/** The first colour no other habit uses. */
function nextColor(habits: readonly Habit[]): SubjectColor {
  const used = new Set(habits.map((habit) => habit.color))
  return (
    COLORS.find((color) => !used.has(color)) ??
    COLORS[habits.length % COLORS.length]
  )
}

/** Adds a habit (or returns the one with that name already). */
export function addHabit(
  name: string,
  weekdays: Weekday[] = [],
  now: Date = new Date(),
): Habit | null {
  const clean = name.trim().slice(0, MAX_NAME_LENGTH)
  if (!clean) return null
  const live = liveHabits(habitsStore.get())
  const existing = live.find(
    (habit) => habit.name.toLowerCase() === clean.toLowerCase(),
  )
  if (existing) return existing
  const stamp = now.toISOString()
  const habit: Habit = {
    id: createId(),
    name: clean,
    color: nextColor(live),
    weekdays,
    order: live.length ? Math.max(...live.map((h) => h.order)) + 1 : 0,
    createdAt: stamp,
    updatedAt: stamp,
    deletedAt: null,
  }
  habitsStore.set((data) => ({ habits: [...data.habits, habit] }))
  return habit
}

export function updateHabit(
  id: string,
  changes: Partial<Pick<Habit, 'name' | 'color' | 'weekdays'>>,
  now: Date = new Date(),
): void {
  habitsStore.set((data) => ({
    habits: data.habits.map((habit) => {
      if (habit.id !== id) return habit
      const name = changes.name?.trim().slice(0, MAX_NAME_LENGTH)
      return {
        ...habit,
        ...changes,
        name: name || habit.name,
        updatedAt: now.toISOString(),
      }
    }),
  }))
}

/** Hides a habit for good (its days stay in the history). */
export function removeHabit(id: string, now: Date = new Date()): void {
  habitsStore.set((data) => ({
    habits: data.habits.map((habit) =>
      habit.id === id
        ? {
            ...habit,
            deletedAt: now.toISOString(),
            updatedAt: now.toISOString(),
          }
        : habit,
    ),
  }))
}

/** The habit open in the sheet ('new' while adding one). */
export const editingHabitStore = createStore<string | null>(null)
export const editHabit = (id: string) => editingHabitStore.set(id)
export const newHabit = () => editingHabitStore.set('new')
export const closeHabitEditor = () => editingHabitStore.set(null)
