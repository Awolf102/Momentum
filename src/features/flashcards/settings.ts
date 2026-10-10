import { isRecord } from '@/lib/guards'
import { createPersistentStore } from '@/lib/persistentStore'

export interface CardSettings {
  /** New cards to start a day, at most. */
  newPerDay: number
  /** The chance of remembering a card that reviews aim for (0.7–0.97). */
  retention: number
  /** A habit that's done for the day once the day's cards are. */
  habitId: string | null
}

export const NEW_PER_DAY_CHOICES = [5, 10, 20, 30, 50] as const
export const RETENTION_CHOICES = [0.8, 0.85, 0.9, 0.95] as const

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value))

export const cardSettingsStore = createPersistentStore<CardSettings>({
  key: 'momentum.cards',
  version: 1,
  defaultValue: { newPerDay: 20, retention: 0.9, habitId: null },
  parse: (data) => {
    if (!isRecord(data)) return null
    const { newPerDay, retention, habitId } = data
    return {
      newPerDay:
        typeof newPerDay === 'number' && Number.isFinite(newPerDay)
          ? clamp(Math.round(newPerDay), 0, 500)
          : 20,
      retention:
        typeof retention === 'number' && Number.isFinite(retention)
          ? clamp(retention, 0.7, 0.97)
          : 0.9,
      habitId: typeof habitId === 'string' ? habitId : null,
    }
  },
})

export function updateCardSettings(changes: Partial<CardSettings>): void {
  cardSettingsStore.set((settings) => ({ ...settings, ...changes }))
}
