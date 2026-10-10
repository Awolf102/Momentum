import type { ChatProviderId, EmbeddingProviderId, ProviderId } from '../types'

export interface ProviderMeta {
  label: string
  /** Whether requests need an API key (local servers usually don't). */
  needsKey: boolean
  chat: boolean
  embeddings: boolean
  /** Runs on this device: nothing is sent anywhere. */
  local: boolean
  keyPlaceholder: string
  /** Where to create a key. */
  keysUrl?: string
}

export const PROVIDERS: Record<ProviderId, ProviderMeta> = {
  anthropic: {
    label: 'Anthropic',
    needsKey: true,
    chat: true,
    embeddings: false,
    local: false,
    keyPlaceholder: 'sk-ant-…',
    keysUrl: 'https://platform.claude.com/',
  },
  openai: {
    label: 'OpenAI',
    needsKey: true,
    chat: true,
    embeddings: true,
    local: false,
    keyPlaceholder: 'sk-…',
    keysUrl: 'https://platform.openai.com/api-keys',
  },
  compatible: {
    label: 'OpenAI-compatible',
    needsKey: false,
    chat: true,
    embeddings: true,
    local: false,
    keyPlaceholder: 'Optional',
  },
  browser: {
    label: 'This device',
    needsKey: false,
    chat: false,
    embeddings: true,
    local: true,
    keyPlaceholder: '',
  },
}

export const PROVIDER_IDS = Object.keys(PROVIDERS) as ProviderId[]

export const CHAT_PROVIDER_IDS = PROVIDER_IDS.filter(
  (id): id is ChatProviderId => PROVIDERS[id].chat,
)

export const EMBEDDING_PROVIDER_IDS = PROVIDER_IDS.filter(
  (id): id is EmbeddingProviderId => PROVIDERS[id].embeddings,
)
