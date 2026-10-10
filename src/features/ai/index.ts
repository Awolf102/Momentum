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
export { SendPreview, type SendItem } from './components/SendPreview'
export { AiError, describeAiError, isAiError, type AiErrorKind } from './errors'
export { useAiReadiness } from './hooks/useAiReadiness'
export {
  formatCost,
  formatMegabytes,
  formatTokenEstimate,
  formatTokens,
} from './lib/format'
export { aiReadiness, type AiReadiness } from './lib/readiness'
export type { RetryInfo } from './lib/retry'
export {
  checkLocalModel,
  downloadSize,
  localModelStore,
  modelStored,
  prepareLocalModel,
  removeLocalModel,
  type LocalModelState,
} from './local/client'
export {
  findLocalModel,
  LOCAL_MODELS,
  modelSource,
  type LocalModel,
} from './local/models'
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
  ChatProviderId,
  EmbeddingProviderId,
  ModelInfo,
  ProviderId,
  StopReason,
  TokenUsage,
} from './types'
