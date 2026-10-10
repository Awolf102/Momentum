/** An embeddings model that runs in the browser, downloaded once. */
export interface LocalModel {
  /** What Settings stores as the model. */
  id: string
  name: string
  /** Where its files are on Hugging Face. */
  repo: string
  revision: string
  files: { model: string; tokenizer: string; tokenizerConfig: string }
  /** The files' total size, to say before downloading. */
  bytes: number
  /** Numbers per vector. */
  dims: number
  /** The longest text it reads, in tokens; the rest is left out. */
  maxTokens: number
  /** How one vector is made from each token's: their mean, or the first. */
  pooling: 'mean' | 'cls'
  language: string
}

export const LOCAL_MODELS: readonly LocalModel[] = [
  {
    id: 'all-MiniLM-L6-v2',
    name: 'MiniLM',
    repo: 'Xenova/all-MiniLM-L6-v2',
    revision: 'main',
    files: {
      // 8-bit weights: a quarter of the size, with nearly the same results.
      model: 'onnx/model_quantized.onnx',
      tokenizer: 'tokenizer.json',
      tokenizerConfig: 'tokenizer_config.json',
    },
    bytes: 22_972_370 + 742_260 + 381,
    dims: 384,
    maxTokens: 256,
    pooling: 'mean',
    language: 'English',
  },
]

export const DEFAULT_LOCAL_MODEL = LOCAL_MODELS[0].id

export function findLocalModel(id: string): LocalModel | undefined {
  return LOCAL_MODELS.find((model) => model.id === id)
}

/**
 * Where model files come from: Hugging Face, or a copy at the same paths on
 * a server of your own (set `VITE_MODEL_HOST` when building).
 */
export const MODEL_HOST = String(
  import.meta.env.VITE_MODEL_HOST || 'https://huggingface.co',
).replace(/\/+$/, '')

export function modelFileUrl(model: LocalModel, file: string): string {
  return `${MODEL_HOST}/${model.repo}/resolve/${model.revision}/${file}`
}

/** Every file a model needs, by URL. */
export function modelFileUrls(model: LocalModel): string[] {
  return Object.values(model.files).map((file) => modelFileUrl(model, file))
}

/** Where the files come from, in words: "Hugging Face", or a host name. */
export function modelSource(): string {
  try {
    const { hostname } = new URL(MODEL_HOST, 'http://localhost')
    return hostname === 'huggingface.co' ? 'Hugging Face' : hostname
  } catch {
    return MODEL_HOST
  }
}
