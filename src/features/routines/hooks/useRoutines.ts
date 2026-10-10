import { useMemo } from 'react'
import type { DateKey } from '@/lib/date'
import { useStore } from '@/lib/store'
import { routineRuns } from '../runs'
import { liveRoutines, routinesStore } from '../store'
import type { Routine, RoutineRun } from '../types'

export function useRoutines(): Routine[] {
  const data = useStore(routinesStore)
  return useMemo(() => liveRoutines(data), [data])
}

/** Every run, by id ("<routine>:<day>"). */
export function useRuns(): ReadonlyMap<string, RoutineRun> {
  const runs = useStore(routineRuns)
  return useMemo(() => new Map(runs.map((run) => [run.id, run])), [runs])
}

/** The days each routine was finished, by routine id. */
export function useCompletedDays(): ReadonlyMap<string, ReadonlySet<DateKey>> {
  const runs = useStore(routineRuns)
  return useMemo(() => {
    const days = new Map<string, Set<DateKey>>()
    for (const run of runs) {
      if (!run.completedAt) continue
      let set = days.get(run.routineId)
      if (!set) days.set(run.routineId, (set = new Set()))
      set.add(run.day)
    }
    return days
  }, [runs])
}
