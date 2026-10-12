import { createStore } from '@/lib/store'
import { ai } from './ai'
import type { ChatEntry } from './chain'
import { describeAiError } from './errors'
import { aiSettingsStore, updateChatEntry } from './store'
import type { ModelInfo, ProviderId } from './types'

export interface ModelList {
  status: 'loading' | 'loaded' | 'error'
  models: ModelInfo[]
  error?: string
}

/**
 * Model lists fetched this session (not saved), by provider, or for one of
 * chat's providers by `chat:<id>` (each has its own address and key).
 */
export const modelListsStore = createStore<Partial<Record<string, ModelList>>>(
  {},
)

/** Where one of chat's providers keeps its list. */
export const entryListKey = (entry: Pick<ChatEntry, 'id'>) => `chat:${entry.id}`

async function load(
  key: string,
  fetch: () => Promise<ModelInfo[]>,
): Promise<ModelInfo[] | null> {
  modelListsStore.set((lists) => ({
    ...lists,
    [key]: { status: 'loading', models: lists[key]?.models ?? [] },
  }))
  try {
    const models = await fetch()
    modelListsStore.set((lists) => ({
      ...lists,
      [key]: { status: 'loaded', models },
    }))
    return models
  } catch (error) {
    modelListsStore.set((lists) => ({
      ...lists,
      [key]: {
        status: 'error',
        models: [],
        error: describeAiError(error),
      },
    }))
    return null
  }
}

/** A provider's models (for embeddings and transcription), from its `/models`. */
export function loadModels(provider: ProviderId): Promise<ModelInfo[] | null> {
  return load(provider, () => ai.listModels(provider))
}

/** One of chat's providers' models, from its own `/models`. */
export function loadEntryModels(entry: ChatEntry): Promise<ModelInfo[] | null> {
  return load(entryListKey(entry), () => ai.listEntryModels(entry))
}

export function forgetModels(key: string): void {
  modelListsStore.set((lists) => {
    const next = { ...lists }
    delete next[key]
    return next
  })
}

/**
 * After a key is saved: fetch that provider's models, and if no chat model
 * is chosen for an Anthropic provider in chat's list yet, pick its newest
 * (Anthropic lists newest first). Nothing is hardcoded: the choice comes
 * from the provider.
 */
export async function refreshModelsAfterKeyChange(
  provider: ProviderId,
): Promise<void> {
  forgetModels(provider)
  const { chain } = aiSettingsStore.get().chat
  for (const entry of chain)
    if (entry.provider === provider) forgetModels(entryListKey(entry))
  const models = await loadModels(provider)
  if (!models || provider !== 'anthropic') return
  const newest = models.find((model) => !model.deprecated)
  if (!newest) return
  for (const entry of chain)
    if (entry.provider === 'anthropic' && !entry.model)
      updateChatEntry(entry.id, { model: newest.id })
}
