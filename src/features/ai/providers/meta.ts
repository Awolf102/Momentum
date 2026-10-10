import type { ProviderId } from '../types'

export interface ProviderMeta {
  label: string
  /** Whether requests need an API key (local servers usually don't). */
  needsKey: boolean
  embeddings: boolean
  keyPlaceholder: string
  /** Where to create a key. */
  keysUrl?: string
}

export const PROVIDERS: Record<ProviderId, ProviderMeta> = {
  anthropic: {
    label: 'Anthropic',
    needsKey: true,
    embeddings: false,
    keyPlaceholder: 'sk-ant-…',
    keysUrl: 'https://platform.claude.com/',
  },
  openai: {
    label: 'OpenAI',
    needsKey: true,
    embeddings: true,
    keyPlaceholder: 'sk-…',
    keysUrl: 'https://platform.openai.com/api-keys',
  },
  compatible: {
    label: 'OpenAI-compatible',
    needsKey: false,
    embeddings: true,
    keyPlaceholder: 'Optional',
  },
}

export const PROVIDER_IDS = Object.keys(PROVIDERS) as ProviderId[]
