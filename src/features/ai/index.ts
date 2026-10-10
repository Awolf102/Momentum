export { ai } from './ai'
export {
  createAiClient,
  EMBED_BATCH,
  type AiClient,
  type ChatOptions,
  type ChatResult,
  type ConnectionTest,
} from './client'
export { AiGate } from './components/AiGate'
export { AiSettingsPanel } from './components/AiSettingsPanel'
export { AiError, describeAiError, isAiError, type AiErrorKind } from './errors'
export { useAiReadiness } from './hooks/useAiReadiness'
export { aiReadiness, type AiReadiness } from './lib/readiness'
export type { RetryInfo } from './lib/retry'
export { PROVIDERS } from './providers/meta'
export {
  createMockProvider,
  type MockProvider,
  type MockReply,
} from './providers/mock'
export { aiSettingsStore, aiUsageStore, type AiSettings } from './store'
export type {
  AiProvider,
  AiTask,
  ChatEvent,
  ChatMessage,
  EmbeddingProviderId,
  ModelInfo,
  ProviderId,
  StopReason,
  TokenUsage,
} from './types'
