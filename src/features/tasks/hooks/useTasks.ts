import { useMemo } from 'react'
import { liveSubjects, subjectsStore } from '@/features/subjects'
import { dayFirst } from '@/lib/locale'
import { useStore } from '@/lib/store'
import { useToday } from '@/lib/useToday'
import type { QuickAddOptions } from '../lib/quickAdd'
import { tasks } from '../tasks'
import type { Task } from '../types'

/** Every task (deleted ones left out), kept up to date. */
export function useTasks(): readonly Task[] {
  return useStore(tasks)
}

/** What quick add needs to read a line: today, the subjects, date order. */
export function useQuickAddOptions(): QuickAddOptions {
  const today = useToday()
  const data = useStore(subjectsStore)
  return useMemo(
    () => ({ today, subjects: liveSubjects(data), dayFirst }),
    [today, data],
  )
}
