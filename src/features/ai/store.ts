import { isRecord } from '@/lib/guards'
import { createPersistentStore } from '@/lib/persistentStore'
import {
  addUsage,
  EMPTY_USAGE,
  monthOf,
  usageKey,
  type UsageData,
  type UsageTotals,
} from './lib/usage'
import { DEFAULT_LOCAL_MODEL } from './local/models'
import {
  CHAT_PROVIDER_IDS,
  EMBEDDING_PROVIDER_IDS,
  TASK_PROVIDER_IDS,
  TRANSCRIPTION_PROVIDER_IDS,
} from './providers/meta'
import type {
  AiTask,
  ChatProviderId,
  EmbeddingProviderId,
  ModelPrice,
  ProviderId,
  TokenUsage,
  TranscriptionProviderId,
} from './types'

interface TaskSettings<P extends ProviderId> {
  provider: P
  /** The model chosen for each provider, so switching back keeps it. */
  models: Partial<Record<P, string>>
}

export interface AiSettings {
  chat: TaskSettings<ChatProviderId>
  embeddings: TaskSettings<EmbeddingProviderId>
  /** Speech to text, for voice notes. */
  transcription: TaskSettings<TranscriptionProviderId>
  /** The OpenAI-compatible server, e.g. a local Ollama. */
  compatibleBaseUrl: string
  /** What each model costs, keyed `provider:model`. Entered by the user. */
  prices: Record<string, ModelPrice>
}

export const DEFAULT_COMPATIBLE_URL = 'http://localhost:11434/v1'

export const DEFAULT_AI_SETTINGS: AiSettings = {
  chat: { provider: 'anthropic', models: {} },
  embeddings: { provider: 'openai', models: {} },
  transcription: { provider: 'openai', models: {} },
  compatibleBaseUrl: DEFAULT_COMPATIBLE_URL,
  prices: {},
}

function parseModels<P extends ProviderId>(
  value: unknown,
  allowed: readonly P[],
): Partial<Record<P, string>> {
  if (!isRecord(value)) return {}
  return Object.fromEntries(
    Object.entries(value).filter(
      (entry): entry is [P, string] =>
        allowed.includes(entry[0] as P) && typeof entry[1] === 'string',
    ),
  ) as Partial<Record<P, string>>
}

function parseTask<P extends ProviderId>(
  value: unknown,
  allowed: readonly P[],
  fallback: TaskSettings<P>,
): TaskSettings<P> {
  if (!isRecord(value)) return fallback
  const provider = allowed.includes(value.provider as P)
    ? (value.provider as P)
    : fallback.provider
  return { provider, models: parseModels(value.models, allowed) }
}

function parsePrices(value: unknown): Record<string, ModelPrice> {
  if (!isRecord(value)) return {}
  const prices: Record<string, ModelPrice> = {}
  for (const [key, price] of Object.entries(value)) {
    if (
      isRecord(price) &&
      typeof price.input === 'number' &&
      typeof price.output === 'number' &&
      price.input >= 0 &&
      price.output >= 0
    ) {
      prices[key] = { input: price.input, output: price.output }
    }
  }
  return prices
}

export function parseAiSettings(data: unknown): AiSettings | null {
  if (!isRecord(data)) return null
  return {
    chat: parseTask(data.chat, CHAT_PROVIDER_IDS, DEFAULT_AI_SETTINGS.chat),
    embeddings: parseTask(
      data.embeddings,
      EMBEDDING_PROVIDER_IDS,
      DEFAULT_AI_SETTINGS.embeddings,
    ),
    // Added with voice notes: older settings simply don't have it yet.
    transcription: parseTask(
      data.transcription,
      TRANSCRIPTION_PROVIDER_IDS,
      DEFAULT_AI_SETTINGS.transcription,
    ),
    compatibleBaseUrl:
      typeof data.compatibleBaseUrl === 'string'
        ? data.compatibleBaseUrl
        : DEFAULT_COMPATIBLE_URL,
    prices: parsePrices(data.prices),
  }
}

export const aiSettingsStore = createPersistentStore<AiSettings>({
  key: 'momentum.ai',
  version: 1,
  defaultValue: DEFAULT_AI_SETTINGS,
  parse: parseAiSettings,
})

/** The provider and model a task uses. */
export function selection(
  settings: AiSettings,
  task: AiTask,
): { provider: ProviderId; model: string } {
  const { provider, models } = settings[task] as TaskSettings<ProviderId>
  const model = (models[provider] ?? '').trim()
  // The model on this device is built in, so there's always one.
  if (provider === 'browser')
    return { provider, model: model || DEFAULT_LOCAL_MODEL }
  return { provider, model }
}

export function setTaskProvider(task: AiTask, provider: ProviderId): void {
  if (!TASK_PROVIDER_IDS[task].includes(provider)) return
  aiSettingsStore.set((settings) => ({
    ...settings,
    [task]: { ...settings[task], provider },
  }))
}

/** Sets the model for a task, for its current provider unless another is named. */
export function setTaskModel(
  task: AiTask,
  model: string,
  provider?: ProviderId,
): void {
  aiSettingsStore.set((settings) => {
    const current = settings[task] as TaskSettings<ProviderId>
    return {
      ...settings,
      [task]: {
        ...current,
        models: { ...current.models, [provider ?? current.provider]: model },
      },
    }
  })
}

export function setCompatibleBaseUrl(url: string): void {
  aiSettingsStore.set((settings) => ({ ...settings, compatibleBaseUrl: url }))
}

export function setPrice(key: string, price: ModelPrice | null): void {
  aiSettingsStore.set((settings) => {
    const prices = { ...settings.prices }
    if (price) prices[key] = price
    else delete prices[key]
    return { ...settings, prices }
  })
}

function isTotals(value: unknown): value is UsageTotals {
  return (
    isRecord(value) &&
    typeof value.inputTokens === 'number' &&
    typeof value.outputTokens === 'number' &&
    typeof value.requests === 'number'
  )
}

export function parseUsage(data: unknown): UsageData | null {
  if (!isRecord(data) || !isRecord(data.months)) return null
  const months: UsageData['months'] = {}
  for (const [month, models] of Object.entries(data.months)) {
    if (!/^\d{4}-\d{2}$/.test(month) || !isRecord(models)) continue
    months[month] = Object.fromEntries(
      Object.entries(models).filter((entry): entry is [string, UsageTotals] =>
        isTotals(entry[1]),
      ),
    )
  }
  return { months }
}

export const aiUsageStore = createPersistentStore<UsageData>({
  key: 'momentum.ai.usage',
  version: 1,
  defaultValue: EMPTY_USAGE,
  parse: parseUsage,
})

export function recordUsage(
  provider: ProviderId,
  model: string,
  usage: TokenUsage,
  now = new Date(),
): void {
  if (usage.inputTokens === 0 && usage.outputTokens === 0) return
  aiUsageStore.set((data) =>
    addUsage(data, monthOf(now), usageKey(provider, model), usage),
  )
}

export function resetUsage(): void {
  aiUsageStore.reset()
}
