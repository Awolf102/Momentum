import engineUrl from 'onnxruntime-web/ort-wasm-simd-threaded.wasm?url'
import { connect, type Connection } from '@/lib/rpc'
import { createStore } from '@/lib/store'
import { filesStored, forgetModelFiles } from './cache'
import type { EmbedWorker } from './embed.worker'
import { findLocalModel, modelFileUrls } from './models'

/** The engine that runs models (ONNX Runtime's WebAssembly), in bytes. */
export const ENGINE_BYTES: number = __ORT_WASM_BYTES__

export type LocalModelState =
  /** Not checked yet. */
  | { status: 'unknown' }
  | { status: 'absent' }
  /** Downloaded, not running. */
  | { status: 'stored' }
  | { status: 'downloading'; loaded: number; total: number }
  /** Downloaded, starting up. */
  | { status: 'starting' }
  | { status: 'ready' }
  /** Something failed; `stored` says whether the files are here regardless. */
  | { status: 'error'; message: string; stored: boolean }

/** The built-in model's state on this device. */
export const localModelStore = createStore<LocalModelState>({
  status: 'unknown',
})

/** What the model needs, by URL: its own files and the engine. */
function filesFor(modelId: string): string[] {
  const model = findLocalModel(modelId)
  return model ? [...modelFileUrls(model), engineUrl] : [engineUrl]
}

/** Total download size for a model, engine included. */
export function downloadSize(modelId: string): number {
  return (findLocalModel(modelId)?.bytes ?? 0) + ENGINE_BYTES
}

let worker: Worker | null = null
let remote: Connection<EmbedWorker> | null = null
let idle: ReturnType<typeof setTimeout> | undefined
let busy = 0

/** The worker sleeps after a while unused, freeing its memory. */
const IDLE_MS = 3 * 60_000

function stop(reason?: string) {
  clearTimeout(idle)
  remote?.close(reason)
  worker?.terminate()
  remote = null
  worker = null
}

function connection(modelId: string): Connection<EmbedWorker> {
  clearTimeout(idle)
  if (remote) return remote
  const started = new Worker(new URL('./embed.worker.ts', import.meta.url), {
    type: 'module',
    name: 'Momentum embeddings',
  })
  const opened = connect<EmbedWorker>(started)
  opened.on('progress', (data) => {
    // News from a load that has already failed (or been dropped) is old.
    if (busy === 0) return
    const { loaded, total, starting } = data as {
      loaded: number
      total: number
      starting?: boolean
    }
    localModelStore.set(
      starting
        ? { status: 'starting' }
        : { status: 'downloading', loaded, total },
    )
  })
  started.addEventListener('error', (event) => {
    event.preventDefault()
    stop('The model stopped unexpectedly.')
    void failed(modelId, event.message || 'The model stopped unexpectedly.')
  })
  worker = started
  remote = opened
  return opened
}

/** Records a failure, and whether the model's files are here anyway. */
async function failed(modelId: string, message: string) {
  const stored = await filesStored(filesFor(modelId)).catch(() => false)
  localModelStore.set({ status: 'error', message, stored })
}

/** Runs a call on the worker, which sleeps again after a while unused. */
async function run<T>(
  modelId: string,
  work: (remote: Connection<EmbedWorker>) => Promise<T>,
) {
  busy++
  try {
    const result = await work(connection(modelId))
    if (localModelStore.get().status !== 'ready')
      localModelStore.set({ status: 'ready' })
    return result
  } catch (error) {
    await failed(
      modelId,
      error instanceof Error ? error.message : String(error),
    )
    throw error
  } finally {
    busy--
    if (busy === 0) {
      clearTimeout(idle)
      idle = setTimeout(() => {
        stop()
        // Asleep, not gone (a failure stays on show).
        if (localModelStore.get().status === 'ready')
          localModelStore.set({ status: 'stored' })
      }, IDLE_MS)
    }
  }
}

/** Downloads the model (if it isn't here yet) and starts it. */
export async function prepareLocalModel(modelId: string): Promise<void> {
  await run(modelId, (remote) =>
    remote.call('load', modelId, engineUrl, ENGINE_BYTES),
  )
}

/** Vectors for texts, from the model on this device. */
export async function embedLocally(
  modelId: string,
  texts: string[],
): Promise<{ vectors: Float32Array; dims: number; tokens: number }> {
  return run(modelId, (remote) =>
    remote.call('embed', modelId, engineUrl, ENGINE_BYTES, texts),
  )
}

/**
 * Checks whether the model is downloaded, unless it's busy or running (or
 * has just failed: that stays on show until it's tried again).
 */
export async function checkLocalModel(modelId: string): Promise<void> {
  const { status } = localModelStore.get()
  if (
    status === 'downloading' ||
    status === 'starting' ||
    status === 'ready' ||
    status === 'error'
  )
    return
  const stored = await filesStored(filesFor(modelId)).catch(() => false)
  localModelStore.set({ status: stored ? 'stored' : 'absent' })
}

/** Whether the model's files are on this device, as far as is known. */
export function modelStored(state: LocalModelState): boolean {
  return (
    state.status === 'stored' ||
    state.status === 'ready' ||
    state.status === 'starting' ||
    (state.status === 'error' && state.stored)
  )
}

/** Stops the model and deletes its files from this device. */
export async function removeLocalModel(): Promise<void> {
  stop('The model was removed.')
  await forgetModelFiles()
  localModelStore.set({ status: 'absent' })
}
