import { createStore } from '@/lib/store'
import { ai } from './ai'
import { describeAiError } from './errors'
import { aiSettingsStore, setTaskModel } from './store'
import type { ModelInfo, ProviderId } from './types'

export interface ModelList {
  status: 'loading' | 'loaded' | 'error'
  models: ModelInfo[]
  error?: string
}

/** Model lists fetched from providers this session (not saved). */
export const modelListsStore = createStore<
  Partial<Record<ProviderId, ModelList>>
>({})

export async function loadModels(
  provider: ProviderId,
): Promise<ModelInfo[] | null> {
  modelListsStore.set((lists) => ({
    ...lists,
    [provider]: { status: 'loading', models: lists[provider]?.models ?? [] },
  }))
  try {
    const models = await ai.listModels(provider)
    modelListsStore.set((lists) => ({
      ...lists,
      [provider]: { status: 'loaded', models },
    }))
    return models
  } catch (error) {
    modelListsStore.set((lists) => ({
      ...lists,
      [provider]: {
        status: 'error',
        models: [],
        error: describeAiError(error),
      },
    }))
    return null
  }
}

export function forgetModels(provider: ProviderId): void {
  modelListsStore.set((lists) => {
    const next = { ...lists }
    delete next[provider]
    return next
  })
}

/**
 * After a key is saved: fetch that provider's models, and if no chat model
 * is chosen for Anthropic yet, pick its newest (Anthropic lists newest
 * first). Nothing is hardcoded: the choice comes from the provider.
 */
export async function refreshModelsAfterKeyChange(
  provider: ProviderId,
): Promise<void> {
  forgetModels(provider)
  const models = await loadModels(provider)
  if (!models || provider !== 'anthropic') return
  if (aiSettingsStore.get().chat.models.anthropic) return
  const newest = models.find((model) => !model.deprecated)
  if (newest) setTaskModel('chat', newest.id, 'anthropic')
}
