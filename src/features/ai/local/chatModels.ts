/**
 * Chat models that run in the browser, on the GPU (WebGPU), through
 * WebLLM. Each comes in two builds: 16-bit numbers where the GPU has them
 * (`shader-f16`, Apple silicon does), 32-bit otherwise. The builds are
 * WebLLM's own (its `prebuiltAppConfig`, for the version pinned in
 * package.json), downloaded from Hugging Face, with the code that runs them
 * from GitHub.
 */
export interface LocalChatModel {
  /** What Settings stores as the model. */
  id: string
  name: string
  /** WebLLM's model ids for each build. */
  builds: { f16: string; f32: string }
  /** About how much each build downloads, in bytes (weights, tokenizer, code). */
  downloadBytes: { f16: number; f32: number }
  /**
   * About how much memory it needs while it runs, in bytes: WebLLM's figure
   * for each build, plus the longer context Momentum gives it.
   */
  memoryBytes: { f16: number; f32: number }
  /** The longest conversation it reads, prompt and reply, in tokens. */
  contextTokens: number
  /** Recommended for an 8 GB Mac. */
  recommended?: boolean
  /** Shown before downloading. */
  caution?: string
}

const GB = 1_000_000_000

export const LOCAL_CHAT_MODELS: readonly LocalChatModel[] = [
  {
    id: 'qwen3.5-0.8b',
    name: 'Qwen3.5 0.8B',
    builds: {
      f16: 'Qwen3.5-0.8B-q4f16_1-MLC',
      f32: 'Qwen3.5-0.8B-q4f32_1-MLC',
    },
    downloadBytes: { f16: 0.45 * GB, f32: 0.5 * GB },
    memoryBytes: { f16: 1.8 * GB, f32: 2.1 * GB },
    contextTokens: 16_384,
  },
  {
    id: 'qwen3.5-2b',
    name: 'Qwen3.5 2B',
    builds: { f16: 'Qwen3.5-2B-q4f16_1-MLC', f32: 'Qwen3.5-2B-q4f32_1-MLC' },
    downloadBytes: { f16: 1.1 * GB, f32: 1.25 * GB },
    memoryBytes: { f16: 2.4 * GB, f32: 2.8 * GB },
    contextTokens: 16_384,
    recommended: true,
  },
  {
    id: 'qwen3.5-4b',
    name: 'Qwen3.5 4B',
    builds: { f16: 'Qwen3.5-4B-q4f16_1-MLC', f32: 'Qwen3.5-4B-q4f32_1-MLC' },
    downloadBytes: { f16: 2.4 * GB, f32: 2.7 * GB },
    memoryBytes: { f16: 4.0 * GB, f32: 4.9 * GB },
    contextTokens: 8192,
    caution:
      'A Mac with 8 GB of memory may struggle: the browser and your other apps need some too.',
  },
]

export const DEFAULT_LOCAL_CHAT_MODEL = 'qwen3.5-2b'

export function findLocalChatModel(id: string): LocalChatModel | undefined {
  return LOCAL_CHAT_MODELS.find((model) => model.id === id)
}

/** Which build suits this GPU: 16-bit numbers if it has them. */
export type Precision = keyof LocalChatModel['builds']

/** The next model down, to suggest when one runs out of memory. */
export function smallerChatModel(id: string): LocalChatModel | undefined {
  const index = LOCAL_CHAT_MODELS.findIndex((model) => model.id === id)
  return index > 0 ? LOCAL_CHAT_MODELS[index - 1] : undefined
}
