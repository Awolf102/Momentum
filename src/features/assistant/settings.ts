import { isRecord } from '@/lib/guards'
import { createPersistentStore } from '@/lib/persistentStore'
import type { PlannerPart } from './types'

export const PLANNER_PARTS: ReadonlyArray<{
  part: PlannerPart
  label: string
}> = [
  { part: 'tasks', label: 'Tasks' },
  { part: 'habits', label: 'Habits' },
  { part: 'routines', label: 'Routines' },
  { part: 'focus', label: 'Focus time' },
  { part: 'log', label: 'Daily log' },
]

export interface AssistantSettings {
  /** What the planning assistant may see, remembered between questions. */
  plannerParts: PlannerPart[]
}

const ALL = PLANNER_PARTS.map(({ part }) => part)

export const assistantSettingsStore = createPersistentStore<AssistantSettings>({
  key: 'momentum.assistant',
  version: 1,
  defaultValue: { plannerParts: ALL },
  parse: (data) =>
    isRecord(data) && Array.isArray(data.plannerParts)
      ? {
          plannerParts: ALL.filter((part) =>
            (data.plannerParts as unknown[]).includes(part),
          ),
        }
      : null,
})

export function togglePlannerPart(part: PlannerPart): void {
  assistantSettingsStore.set((settings) => ({
    plannerParts: settings.plannerParts.includes(part)
      ? settings.plannerParts.filter((each) => each !== part)
      : ALL.filter(
          (each) => each === part || settings.plannerParts.includes(each),
        ),
  }))
}
