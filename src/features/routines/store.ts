import type { Weekday } from '@/lib/date'
import { isRecord } from '@/lib/guards'
import { createId } from '@/lib/id'
import { createPersistentStore } from '@/lib/persistentStore'
import { createStore } from '@/lib/store'
import type { PartOfDay, Routine, RoutineStep } from './types'

export interface RoutinesData {
  routines: Routine[]
}

export const MAX_NAME_LENGTH = 60
export const MAX_STEP_LENGTH = 120
const PARTS: readonly PartOfDay[] = [
  'morning',
  'afternoon',
  'evening',
  'anytime',
]

function parseStep(value: unknown): RoutineStep | null {
  if (!isRecord(value) || typeof value.id !== 'string') return null
  if (typeof value.text !== 'string' || !value.text.trim()) return null
  return { id: value.id, text: value.text.trim().slice(0, MAX_STEP_LENGTH) }
}

function parseRoutine(value: unknown): Routine | null {
  if (!isRecord(value)) return null
  const { id, name, part, steps, weekdays, order, createdAt, updatedAt } = value
  if (typeof id !== 'string' || typeof name !== 'string' || !name.trim())
    return null
  if (typeof createdAt !== 'string' || typeof updatedAt !== 'string')
    return null
  return {
    id,
    name: name.trim().slice(0, MAX_NAME_LENGTH),
    part: PARTS.includes(part as PartOfDay) ? (part as PartOfDay) : 'anytime',
    steps: Array.isArray(steps)
      ? steps
          .map(parseStep)
          .filter((step): step is RoutineStep => step !== null)
      : [],
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
    deletedAt: typeof value.deletedAt === 'string' ? value.deletedAt : null,
  }
}

export function parseRoutines(data: unknown): RoutinesData | null {
  if (!isRecord(data) || !Array.isArray(data.routines)) return null
  const seen = new Set<string>()
  const routines: Routine[] = []
  for (const value of data.routines) {
    const routine = parseRoutine(value)
    if (!routine || seen.has(routine.id)) continue
    seen.add(routine.id)
    routines.push(routine)
  }
  return { routines }
}

/** Restoring a backup keeps routines from both sides; the later edit wins. */
export function mergeRoutines(
  current: RoutinesData,
  incoming: RoutinesData,
): RoutinesData {
  const byId = new Map(current.routines.map((routine) => [routine.id, routine]))
  for (const routine of incoming.routines) {
    const mine = byId.get(routine.id)
    if (!mine || routine.updatedAt > mine.updatedAt)
      byId.set(routine.id, routine)
  }
  return { routines: [...byId.values()] }
}

export const routinesStore = createPersistentStore<RoutinesData>({
  key: 'momentum.routines',
  version: 1,
  defaultValue: { routines: [] },
  parse: parseRoutines,
  merge: mergeRoutines,
})

export const liveRoutines = (data: RoutinesData): Routine[] =>
  data.routines
    .filter((routine) => !routine.deletedAt)
    .sort((a, b) => a.order - b.order || (a.createdAt < b.createdAt ? -1 : 1))

export function addRoutine(
  input: {
    name: string
    part: PartOfDay
    steps?: string[]
    weekdays?: Weekday[]
  },
  now: Date = new Date(),
): Routine | null {
  const name = input.name.trim().slice(0, MAX_NAME_LENGTH)
  if (!name) return null
  const live = liveRoutines(routinesStore.get())
  const stamp = now.toISOString()
  const routine: Routine = {
    id: createId(),
    name,
    part: input.part,
    steps: (input.steps ?? [])
      .map((text) => text.trim().slice(0, MAX_STEP_LENGTH))
      .filter(Boolean)
      .map((text) => ({ id: createId(), text })),
    weekdays: input.weekdays ?? [],
    order: live.length ? Math.max(...live.map((r) => r.order)) + 1 : 0,
    createdAt: stamp,
    updatedAt: stamp,
    deletedAt: null,
  }
  routinesStore.set((data) => ({ routines: [...data.routines, routine] }))
  return routine
}

function change(
  id: string,
  update: (routine: Routine) => Routine,
  now: Date,
): void {
  routinesStore.set((data) => ({
    routines: data.routines.map((routine) =>
      routine.id === id
        ? { ...update(routine), updatedAt: now.toISOString() }
        : routine,
    ),
  }))
}

export function updateRoutine(
  id: string,
  changes: Partial<Pick<Routine, 'name' | 'part' | 'weekdays'>>,
  now: Date = new Date(),
): void {
  change(
    id,
    (routine) => ({
      ...routine,
      ...changes,
      name: changes.name?.trim().slice(0, MAX_NAME_LENGTH) || routine.name,
    }),
    now,
  )
}

export function addStep(id: string, text: string, now: Date = new Date()) {
  const clean = text.trim().slice(0, MAX_STEP_LENGTH)
  if (!clean) return
  change(
    id,
    (routine) => ({
      ...routine,
      steps: [...routine.steps, { id: createId(), text: clean }],
    }),
    now,
  )
}

export function updateStep(
  id: string,
  stepId: string,
  text: string,
  now: Date = new Date(),
) {
  const clean = text.trim().slice(0, MAX_STEP_LENGTH)
  if (!clean) return
  change(
    id,
    (routine) => ({
      ...routine,
      steps: routine.steps.map((step) =>
        step.id === stepId ? { ...step, text: clean } : step,
      ),
    }),
    now,
  )
}

export function removeStep(id: string, stepId: string, now: Date = new Date()) {
  change(
    id,
    (routine) => ({
      ...routine,
      steps: routine.steps.filter((step) => step.id !== stepId),
    }),
    now,
  )
}

/** Moves a step up (-1) or down (+1). */
export function moveStep(
  id: string,
  stepId: string,
  by: -1 | 1,
  now: Date = new Date(),
) {
  change(
    id,
    (routine) => {
      const steps = [...routine.steps]
      const from = steps.findIndex((step) => step.id === stepId)
      const to = from + by
      if (from < 0 || to < 0 || to >= steps.length) return routine
      ;[steps[from], steps[to]] = [steps[to], steps[from]]
      return { ...routine, steps }
    },
    now,
  )
}

export function removeRoutine(id: string, now: Date = new Date()): void {
  change(id, (routine) => ({ ...routine, deletedAt: now.toISOString() }), now)
}

/** The routine open in the sheet ('new' while choosing one to add). */
export const editingRoutineStore = createStore<string | null>(null)
export const editRoutine = (id: string) => editingRoutineStore.set(id)
export const newRoutine = () => editingRoutineStore.set('new')
export const closeRoutineEditor = () => editingRoutineStore.set(null)
