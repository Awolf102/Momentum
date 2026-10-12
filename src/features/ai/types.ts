/**
 * Where AI runs: a service Momentum talks to (API keys are saved under
 * these names), or `browser`, a model running on this device.
 */
export type ProviderId = 'anthropic' | 'openai' | 'compatible' | 'browser'

/** The providers that chat: every one, the model on this device included. */
export type ChatProviderId = ProviderId

/**
 * Anthropic has no embeddings API, so embeddings come from the others: OpenAI,
 * a compatible server, or the model on this device.
 */
export type EmbeddingProviderId = Exclude<ProviderId, 'anthropic'>

/** Speech to text comes from OpenAI or a compatible server; Anthropic offers none. */
export type TranscriptionProviderId = 'openai' | 'compatible'

export type AiTask = 'chat' | 'embeddings' | 'transcription'

/**
 * What a chat request is for. Each has its own Thinking switch in
 * Settings → AI: Ask; suggesting cards; writing and marking quizzes;
 * summaries (the weekly write-up, tidying a voice note); Plan my day; and
 * writing out photos of notes.
 */
export type ChatFeature =
  'ask' | 'cards' | 'quizzes' | 'summaries' | 'planning' | 'photos'

/** Part of a message: some text, or a picture (sent as base64). */
export type ContentPart =
  | { type: 'text'; text: string }
  | {
      type: 'image'
      mediaType: 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif'
      /** Base64, without a `data:` prefix. */
      data: string
    }

export interface ChatMessage {
  role: 'user' | 'assistant'
  /** Text, or text and pictures (for a model that can read them). */
  content: string | ContentPart[]
}

export interface ChatRequest {
  model: string
  messages: ChatMessage[]
  system?: string
  /** Upper bound on the reply's length, in tokens. */
  maxTokens?: number
  /**
   * `false` asks a model that thinks before answering not to, where the
   * provider has a way to say so; otherwise it's left to the model.
   */
  thinking?: boolean
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
  /** The model is thinking before it answers (what it thinks isn't kept). */
  | { type: 'thinking' }
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

export interface TranscribeRequest {
  model: string
  audio: Blob
  /** A name with the right extension: providers tell the format by it. */
  fileName: string
  /** The language spoken (ISO 639-1), when known; it helps accuracy. */
  language?: string
  signal?: AbortSignal
}

export interface TranscribeResult {
  text: string
  /** Tokens, when the model is billed by them (Whisper is billed by the minute). */
  usage?: TokenUsage
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
  transcribe(request: TranscribeRequest): Promise<TranscribeResult>
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
