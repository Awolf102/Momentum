/// <reference lib="webworker" />
/**
 * Runs an embeddings model in the browser, off the main thread: ONNX Runtime
 * (WebAssembly) with the model's own tokenizer. The engine and the model's
 * files are downloaded once and kept (see `cache.ts`).
 */
import { Tokenizer } from '@huggingface/tokenizers'
import * as ort from 'onnxruntime-web/wasm'
import { emit, expose, withTransfer, type Port } from '@/lib/rpc'
import { cachedBytes } from './cache'
import { findLocalModel, modelFileUrl, type LocalModel } from './models'
import { batchesByLength, encodeTexts, pool, toBatch } from './pipeline'

const port = self as unknown as Port

/** Texts per run of the model: enough to be quick, not so many as to use lots of memory. */
const BATCH = 16

interface Loaded {
  model: LocalModel
  session: ort.InferenceSession
  tokenizer: Tokenizer
}

let loaded: Promise<Loaded> | null = null
let loadedId = ''

/** Sends download progress across all the files, as one total. */
function progressTracker(total: number, signal: AbortSignal) {
  let done = 0
  let last = 0
  return (count: number) => {
    // A download that failed stops the rest, and their news.
    if (signal.aborted) return
    done += count
    // A few updates a second is plenty.
    const now = performance.now()
    if (now - last > 120 || done >= total) {
      last = now
      emit(port, 'progress', { loaded: Math.min(done, total), total })
    }
  }
}

async function load(
  modelId: string,
  engineUrl: string,
  engineBytes: number,
): Promise<Loaded> {
  const model = findLocalModel(modelId)
  if (!model) throw new Error(`There's no built-in model called ${modelId}.`)
  const stop = new AbortController()
  const onBytes = progressTracker(model.bytes + engineBytes, stop.signal)
  const fetchFile = (url: string, replaces?: (cached: string) => boolean) =>
    cachedBytes(url, onBytes, { replaces, signal: stop.signal }).catch(
      (error: unknown) => {
        stop.abort()
        throw error
      },
    )
  const [engine, weights, tokenizerJson, tokenizerConfig] = await Promise.all([
    // Older engines (from before an update) are deleted when this one is kept.
    fetchFile(engineUrl, (url) => url.includes('/ort-wasm')),
    fetchFile(modelFileUrl(model, model.files.model)),
    fetchFile(modelFileUrl(model, model.files.tokenizer)),
    fetchFile(modelFileUrl(model, model.files.tokenizerConfig)),
  ])
  emit(port, 'progress', {
    loaded: model.bytes + engineBytes,
    total: model.bytes + engineBytes,
    starting: true,
  })
  ort.env.wasm.wasmBinary = engine
  // One thread: more would need cross-origin isolation, which Momentum
  // doesn't have, and this already runs off the main thread.
  ort.env.wasm.numThreads = 1
  ort.env.wasm.proxy = false
  const decoder = new TextDecoder()
  const tokenizer = new Tokenizer(
    JSON.parse(decoder.decode(tokenizerJson)),
    JSON.parse(decoder.decode(tokenizerConfig)),
  )
  const session = await ort.InferenceSession.create(new Uint8Array(weights), {
    executionProviders: ['wasm'],
    graphOptimizationLevel: 'all',
  })
  return { model, session, tokenizer }
}

function ensure(modelId: string, engineUrl: string, engineBytes: number) {
  if (!loaded || loadedId !== modelId) {
    loadedId = modelId
    const loading = load(modelId, engineUrl, engineBytes)
    loaded = loading
    // A failed load is tried again next time.
    loading.catch(() => {
      if (loaded === loading) loaded = null
    })
  }
  return loaded
}

const handlers = {
  /** Downloads (if needed) and starts the model. Returns its vector size. */
  async load(modelId: string, engineUrl: string, engineBytes: number) {
    const { model } = await ensure(modelId, engineUrl, engineBytes)
    return { dims: model.dims }
  },

  /** One unit-length vector per text, all in one array, in order. */
  async embed(
    modelId: string,
    engineUrl: string,
    engineBytes: number,
    texts: string[],
  ) {
    const { model, session, tokenizer } = await ensure(
      modelId,
      engineUrl,
      engineBytes,
    )
    const rows = encodeTexts(tokenizer, texts, model.maxTokens)
    const vectors = new Float32Array(texts.length * model.dims)
    let tokens = 0
    for (const indexes of batchesByLength(rows, BATCH)) {
      const batch = toBatch(indexes.map((index) => rows[index]))
      const feeds: Record<string, ort.Tensor> = {
        input_ids: new ort.Tensor('int64', batch.ids, batch.shape),
        attention_mask: new ort.Tensor('int64', batch.mask, batch.shape),
        token_type_ids: new ort.Tensor('int64', batch.types, batch.shape),
      }
      const inputs = Object.fromEntries(
        session.inputNames
          .filter((name) => name in feeds)
          .map((name) => [name, feeds[name]]),
      )
      const output = await session.run(inputs)
      const hidden = output.last_hidden_state ?? output[session.outputNames[0]]
      const pooled = pool(
        hidden.data as Float32Array,
        hidden.dims,
        batch.lengths,
        model.pooling,
      )
      indexes.forEach((index, position) =>
        vectors.set(
          pooled.subarray(position * model.dims, (position + 1) * model.dims),
          index * model.dims,
        ),
      )
      for (const tensor of Object.values(output)) tensor.dispose()
      tokens += batch.lengths.reduce((sum, length) => sum + length, 0)
    }
    return withTransfer({ vectors, dims: model.dims, tokens }, [vectors.buffer])
  },
}

export type EmbedWorker = typeof handlers

expose(handlers, port)
