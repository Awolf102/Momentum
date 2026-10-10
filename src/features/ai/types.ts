/**
 * Where AI runs: a service Momentum talks to (API keys are saved under
 * these names), or `browser`, a model running on this device.
 */
export type ProviderId = 'anthropic' | 'openai' | 'compatible' | 'browser'

/** The providers that chat (the model on this device only makes embeddings). */
export type ChatProviderId = Exclude<ProviderId, 'browser'>

/**
 * Anthropic has no embeddings API, so embeddings come from the others: OpenAI,
 * a compatible server, or the model on this device.
 */
export type EmbeddingProviderId = Exclude<ProviderId, 'anthropic'>

export type AiTask = 'chat' | 'embeddings'

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface ChatRequest {
  model: string
  messages: ChatMessage[]
  system?: string
  /** Upper bound on the reply's length, in tokens. */
  maxTokens?: number
  signal?: AbortSignal
}

export interface TokenUsage {
  inputTokens: number
  outputTokens: number
}

/** Why a reply ended: finished, cut off at the length limit, or declined. */
export type StopReason = 'end' | 'max-tokens' | 'refusal' | 'other'

export type ChatEvent =
  | { type: 'text'; text: string }
  /** Running totals for the request; the last one is final. */
  | { type: 'usage'; usage: TokenUsage }
  | { type: 'done'; stopReason: StopReason }

export interface EmbedRequest {
  model: string
  input: string[]
  signal?: AbortSignal
}

export interface EmbedResult {
  /** One vector per input, in input order. */
  vectors: number[][]
  usage: TokenUsage
}

export interface ModelInfo {
  id: string
  /** A friendlier name, when the provider gives one. */
  name?: string
  /** The longest reply the model allows, when the provider says. */
  maxOutputTokens?: number
  deprecated?: boolean
}

/** One provider's API behind a common interface. */
export interface AiProvider {
  readonly id: ProviderId | 'mock'
  chat(request: ChatRequest): AsyncIterable<ChatEvent>
  embed(request: EmbedRequest): Promise<EmbedResult>
  listModels(signal?: AbortSignal): Promise<ModelInfo[]>
}

/** Everything needed to reach one provider. */
export interface Connection {
  provider: ProviderId
  apiKey?: string
  /** For OpenAI-compatible servers. */
  baseUrl?: string
}

/** What a model costs per million tokens, as entered by the user. */
export interface ModelPrice {
  input: number
  output: number
}
