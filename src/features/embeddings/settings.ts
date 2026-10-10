import { isRecord } from '@/lib/guards'
import { createPersistentStore } from '@/lib/persistentStore'

export interface EmbeddingSettings {
  /** Notes and documents (`note:<id>`…) never sent to be indexed. */
  excluded: string[]
}

export const embeddingSettingsStore = createPersistentStore<EmbeddingSettings>({
  key: 'momentum.embeddings',
  version: 1,
  defaultValue: { excluded: [] },
  parse: (data) =>
    isRecord(data) && Array.isArray(data.excluded)
      ? {
          excluded: data.excluded.filter(
            (key): key is string => typeof key === 'string',
          ),
        }
      : null,
})

export function excludedKeys(): ReadonlySet<string> {
  return new Set(embeddingSettingsStore.get().excluded)
}

/** Keeps sources out of the index, or lets them back in. */
export function setExcluded(keys: readonly string[], excluded: boolean): void {
  if (keys.length === 0) return
  embeddingSettingsStore.set((settings) => {
    const next = new Set(settings.excluded)
    for (const key of keys) {
      if (excluded) next.add(key)
      else next.delete(key)
    }
    return { excluded: [...next] }
  })
}
