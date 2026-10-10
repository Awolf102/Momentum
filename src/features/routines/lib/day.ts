import type { PartOfDay, Routine, RoutineRun } from '../types'

export const PART_NAMES: Record<PartOfDay, string> = {
  morning: 'Morning',
  afternoon: 'Afternoon',
  evening: 'Evening',
  anytime: 'Any time',
}

/** Morning until noon (from 4am), afternoon until 5pm, then evening. */
export function partOfDay(hour: number): Exclude<PartOfDay, 'anytime'> {
  if (hour >= 4 && hour < 12) return 'morning'
  if (hour >= 12 && hour < 17) return 'afternoon'
  return 'evening'
}

const ORDER: PartOfDay[] = ['morning', 'afternoon', 'evening', 'anytime']

/**
 * Today's routines, the one for now first: this part of the day, then any
 * time, then the rest of the day in order (an unfinished morning routine is
 * still there in the evening).
 */
export function sortForNow(
  routines: readonly Routine[],
  now: Exclude<PartOfDay, 'anytime'>,
): Routine[] {
  const rank = (part: PartOfDay) =>
    part === now ? 0 : part === 'anytime' ? 1 : 2 + ORDER.indexOf(part)
  return [...routines].sort(
    (a, b) => rank(a.part) - rank(b.part) || a.order - b.order,
  )
}

/** Steps done of the routine's current steps (ones removed since don't count). */
export function progress(routine: Routine, run: RoutineRun | undefined) {
  const done = new Set(run?.done ?? [])
  const count = routine.steps.filter((step) => done.has(step.id)).length
  return {
    done: count,
    total: routine.steps.length,
    complete: routine.steps.length > 0 && count === routine.steps.length,
  }
}

/** Ready-made routines to start from. */
export const TEMPLATES: { name: string; part: PartOfDay; steps: string[] }[] = [
  {
    name: 'Morning',
    part: 'morning',
    steps: ['Glass of water', 'Stretch for 5 minutes', "Plan the day's tasks"],
  },
  {
    name: 'Study session',
    part: 'anytime',
    steps: [
      'Phone on silent, in another room',
      'Pick a subject and a goal',
      'Start a focus session',
    ],
  },
  {
    name: 'Evening',
    part: 'evening',
    steps: [
      "Write today's log line",
      "Check tomorrow's tasks",
      'Tidy the desk',
      'Read before bed',
    ],
  },
]
