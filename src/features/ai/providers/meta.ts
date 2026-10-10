import type {
  AiTask,
  ChatProviderId,
  EmbeddingProviderId,
  ProviderId,
  TranscriptionProviderId,
} from '../types'

export interface ProviderMeta {
  label: string
  /** Whether requests need an API key (local servers usually don't). */
  needsKey: boolean
  chat: boolean
  embeddings: boolean
  /** Turns speech into text. */
  transcription: boolean
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
    transcription: false,
    local: false,
    keyPlaceholder: 'sk-ant-…',
    keysUrl: 'https://platform.claude.com/',
  },
  openai: {
    label: 'OpenAI',
    needsKey: true,
    chat: true,
    embeddings: true,
    transcription: true,
    local: false,
    keyPlaceholder: 'sk-…',
    keysUrl: 'https://platform.openai.com/api-keys',
  },
  compatible: {
    label: 'OpenAI-compatible',
    needsKey: false,
    chat: true,
    embeddings: true,
    transcription: true,
    local: false,
    keyPlaceholder: 'Optional',
  },
  browser: {
    label: 'This device',
    needsKey: false,
    chat: false,
    embeddings: true,
    transcription: false,
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

export const TRANSCRIPTION_PROVIDER_IDS = PROVIDER_IDS.filter(
  (id): id is TranscriptionProviderId => PROVIDERS[id].transcription,
)

/** The providers that can do a task. */
export const TASK_PROVIDER_IDS: Record<AiTask, readonly ProviderId[]> = {
  chat: CHAT_PROVIDER_IDS,
  embeddings: EMBEDDING_PROVIDER_IDS,
  transcription: TRANSCRIPTION_PROVIDER_IDS,
}
