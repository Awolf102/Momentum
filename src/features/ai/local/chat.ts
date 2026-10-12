/**
 * The chat model on this device, from the page's side: what's downloaded,
 * downloading it, and talking to the worker that runs it. The worker starts
 * on the first request (never at start-up), keeps the model on the GPU
 * while it's used, and is stopped after ten minutes unused, or straight
 * away if the model runs out of memory, so the GPU's memory comes back and
 * the rest of Momentum carries on.
 */
import { connect, type Connection, type Port } from '@/lib/rpc'
import type { Store } from '@/lib/store'
import { abortError, AiError, isAiError } from '../errors'
import { createThinkSplitter } from '../lib/thinking'
import type { ChatEvent, ChatRequest, StopReason } from '../types'
import type { ChatWorker } from './chat.worker'
import type { StoredFiles } from './chatCache'
import type { LocalChatState } from './chatState'
import {
  findLocalChatModel,
  LOCAL_CHAT_MODELS,
  smallerChatModel,
  type LocalChatModel,
  type Precision,
} from './chatModels'
import type { LoadProgress } from './chatProgress'
import { noGpuMessage, type GpuSupport } from './webgpu'

/** A worker, as the manager needs it. */
export interface WorkerHandle {
  port: Port
  terminate(): void
  /** Called if the worker itself fails (it crashed, or couldn't start). */
  onError(listener: (message: string) => void): void
}

export interface LocalChatDeps {
  /** Where its state is kept, for Settings and readiness to read. */
  store: Store<LocalChatState>
  startWorker(): WorkerHandle
  gpu(): Promise<GpuSupport>
  stored(build: string): Promise<StoredFiles>
  remove(build: string): Promise<void>
  /** `navigator.storage.persist()`: true when granted. */
  persist(): Promise<boolean>
  persisted(): Promise<boolean>
  estimate(): Promise<{ usage: number; quota: number } | null>
  /** How long the model stays loaded unused: ten minutes. */
  idleMs?: number
}

/** Ten minutes unused, and the model comes off the GPU. */
export const CHAT_IDLE_MS = 10 * 60_000

type FailureKind = 'memory' | 'too-long' | 'unsupported' | 'network' | 'other'

/** What went wrong, from an error the worker (or WebLLM in it) gave. */
export function classifyFailure(error: unknown): FailureKind {
  const text =
    error instanceof Error ? `${error.name} ${error.message}` : String(error)
  if (
    /DeviceLost|device (?:was |is )?lost|out of memory|OutOfMemory|allocat|insufficient memory|stopped unexpectedly/i.test(
      text,
    )
  )
    return 'memory'
  if (
    /ContextWindowSizeExceeded|context window|prompt.*(too long|exceed)/i.test(
      text,
    )
  )
    return 'too-long'
  if (/WebGPUNot|ShaderF16|FeatureSupport|webgpu/i.test(text))
    return 'unsupported'
  if (/fetch|network|Load failed|Cannot fetch|download/i.test(text))
    return 'network'
  return 'other'
}

/** How a reply ended, from the worker. */
type Outcome =
  | { ok: true; finish: string | null; usage?: ChatEvent }
  | { ok: false; error: unknown }

function stopReasonOf(finish: string | null): StopReason {
  if (finish === 'stop') return 'end'
  if (finish === 'length') return 'max-tokens'
  return 'other'
}

export function createLocalChat(deps: LocalChatDeps) {
  const { store } = deps
  const idleMs = deps.idleMs ?? CHAT_IDLE_MS

  interface Runner {
    handle: WorkerHandle
    remote: Connection<ChatWorker>
    model: LocalChatModel
    build: string
    loading: Promise<unknown>
  }
  let runner: Runner | null = null
  let downloader: { handle: WorkerHandle; model: string } | null = null
  let idle: ReturnType<typeof setTimeout> | undefined
  let busy = 0
  let nextId = 0

  const update = (change: Partial<LocalChatState>) =>
    store.set((state) => ({ ...state, ...change }))

  async function precision(): Promise<Precision> {
    const gpu = await deps.gpu()
    if (gpu.status === 'available') return gpu.precision
    throw new AiError(
      'unsupported',
      noGpuMessage(gpu.status === 'missing' ? gpu.reason : 'no-webgpu'),
    )
  }

  /** The build this device runs: GPUs without 16-bit numbers get the other. */
  async function buildOf(model: LocalChatModel): Promise<string> {
    const gpu = await deps.gpu()
    return model.builds[gpu.status === 'available' ? gpu.precision : 'f16']
  }

  async function refresh(ids = LOCAL_CHAT_MODELS.map((model) => model.id)) {
    const files = { ...store.get().files }
    for (const id of ids) {
      const model = findLocalChatModel(id)
      if (!model) continue
      const found = await deps.stored(await buildOf(model)).catch(() => null)
      files[id] = !found
        ? { status: 'unknown' }
        : found.complete
          ? { status: 'stored', ...found }
          : found.bytes > 0
            ? { status: 'partial', ...found }
            : { status: 'absent' }
    }
    update({
      files,
      persisted: await deps.persisted().catch(() => null),
      storage: await deps.estimate().catch(() => null),
    })
  }

  /** Stops the worker running the model, freeing the GPU's memory. */
  function unload(reason = 'The model was unloaded.') {
    clearTimeout(idle)
    if (!runner) return
    runner.remote.close(reason)
    runner.handle.terminate()
    runner = null
    update({ running: null })
  }

  function sleepLater() {
    clearTimeout(idle)
    if (busy === 0 && runner) idle = setTimeout(() => unload(), idleMs)
  }

  /** The model on the GPU, loading it first if it isn't. */
  async function loaded(model: LocalChatModel, build: string) {
    if (runner?.build !== build) {
      unload()
      const handle = deps.startWorker()
      const remote = connect<ChatWorker>(handle.port)
      const current: Runner = {
        handle,
        remote,
        model,
        build,
        loading: Promise.resolve(),
      }
      runner = current
      update({ running: { model: model.id, status: 'loading', fraction: 0 } })
      remote.on('progress', (data) => {
        const progress = data as LoadProgress
        if (runner !== current || progress.phase !== 'load') return
        update({
          running: {
            model: model.id,
            status: 'loading',
            fraction: progress.fraction,
          },
        })
      })
      handle.onError((message) => {
        if (runner !== current) return
        unload(message || 'The model stopped unexpectedly.')
      })
      current.loading = remote
        .call('load', build, model.contextTokens)
        .then(() => {
          if (runner === current)
            update({
              running: { model: model.id, status: 'ready', fraction: 1 },
            })
        })
    }
    await runner!.loading
    return runner!
  }

  /** An error from the worker, as an AiError; out of memory unloads it. */
  function failure(error: unknown, model: LocalChatModel): AiError {
    if (isAiError(error)) return error
    const kind = classifyFailure(error)
    const detail = error instanceof Error ? error.message : String(error)
    if (kind === 'memory') {
      unload()
      const smaller = smallerChatModel(model.id)
      const message = `${model.name} ran out of memory on this device and was unloaded.${smaller ? ` Try ${smaller.name}, which needs less.` : ' Close other apps and tabs and try again, or choose another provider.'}`
      update({ problem: { model: model.id, kind: 'memory', message } })
      return new AiError('memory', message, { cause: error })
    }
    if (kind === 'too-long')
      return new AiError(
        'bad-request',
        `That’s more than ${model.name} can read at once (about ${Math.round((model.contextTokens * 0.75) / 1000)},000 words, with its reply). Send less, or choose another provider.`,
        { cause: error },
      )
    if (kind === 'unsupported') return new AiError('unsupported', detail)
    if (kind === 'network')
      return new AiError(
        'network',
        "Couldn't download the model. Check your connection and try again.",
        { cause: error },
      )
    return new AiError('unknown', detail, { cause: error })
  }

  /** Streams a reply from the model on this device. */
  async function* chat(request: ChatRequest): AsyncGenerator<ChatEvent> {
    if (request.signal?.aborted) throw abortError()
    const model = findLocalChatModel(request.model)
    if (!model)
      throw new AiError(
        'not-found',
        `There’s no model on this device called ${request.model}. Choose one in Settings → AI.`,
      )
    if (
      request.messages.some(
        (message) =>
          typeof message.content !== 'string' &&
          message.content.some((part) => part.type === 'image'),
      )
    )
      throw new AiError(
        'unsupported',
        'The model on this device reads text, not pictures. Choose another provider for notes from photos.',
      )
    await precision()
    const build = await buildOf(model)
    const files = await deps.stored(build)
    if (!files.complete)
      throw new AiError(
        'unavailable',
        `${model.name} isn’t on this device yet. Download it in Settings → AI.`,
      )
    busy++
    clearTimeout(idle)
    const id = nextId++
    let remote: Connection<ChatWorker> | null = null
    let finished = false
    const onAbort = () => void remote?.call('interrupt').catch(() => {})
    try {
      const running = await loaded(model, build)
      remote = running.remote
      if (request.signal?.aborted) throw abortError()
      request.signal?.addEventListener('abort', onAbort, { once: true })
      const pieces: string[] = []
      let wake: (() => void) | null = null
      // Set by the call below, when it ends.
      let outcome = null as Outcome | null
      const off = remote.on('chunk', (data) => {
        const chunk = data as { id: number; text: string }
        if (chunk.id !== id) return
        pieces.push(chunk.text)
        wake?.()
      })
      remote
        .call('generate', id, {
          system: request.system,
          messages: request.messages.map((message) => ({
            role: message.role,
            content: message.content as string,
          })),
          maxTokens: request.maxTokens ?? model.contextTokens,
          thinking: request.thinking !== false,
        })
        .then(
          (result) => {
            outcome = {
              ok: true,
              finish: result.finish,
              usage: result.usage
                ? { type: 'usage', usage: result.usage }
                : undefined,
            }
          },
          (error: unknown) => (outcome = { ok: false, error }),
        )
        .finally(() => wake?.())
      const splitter = createThinkSplitter()
      try {
        for (;;) {
          while (pieces.length > 0) {
            const split = splitter.push(pieces.shift()!)
            if (split.thinking) yield { type: 'thinking' }
            if (split.text) yield { type: 'text', text: split.text }
          }
          if (outcome) break
          await new Promise<void>((resolve) => (wake = resolve))
          wake = null
        }
      } finally {
        off()
      }
      const result = outcome!
      if (!result.ok) throw result.error
      if (request.signal?.aborted || result.finish === 'abort')
        throw abortError()
      const held = splitter.flush()
      if (held) yield { type: 'text', text: held }
      if (result.usage) yield result.usage
      finished = true
      yield { type: 'done', stopReason: stopReasonOf(result.finish) }
    } catch (error) {
      throw failure(error, model)
    } finally {
      request.signal?.removeEventListener('abort', onAbort)
      // The caller stopped reading early: stop writing.
      if (!finished) onAbort()
      busy--
      sleepLater()
    }
  }

  /** Downloads a model's files, without putting it on the GPU. */
  async function download(id: string): Promise<void> {
    const model = findLocalChatModel(id)
    if (!model || downloader) return
    const precisionHere = await precision()
    const build = model.builds[precisionHere]
    // Asked first, so the browser keeps what's about to arrive.
    const persisted = await deps.persist().catch(() => false)
    const handle = deps.startWorker()
    const remote = connect<ChatWorker>(handle.port)
    downloader = { handle, model: id }
    const estimate = model.downloadBytes[precisionHere]
    const problem = store.get().problem
    update({
      persisted,
      download: { model: id, loaded: 0, total: estimate, fraction: 0 },
      problem: problem?.model === id ? null : problem,
    })
    remote.on('progress', (data) => {
      const progress = data as LoadProgress
      if (downloader?.handle !== handle || progress.phase !== 'download') return
      const total = progress.total ?? estimate
      update({
        download: {
          model: id,
          total,
          fraction: progress.fraction,
          loaded: progress.loaded ?? Math.round(progress.fraction * total),
        },
      })
    })
    const crashed = new Promise<never>((_, reject) =>
      handle.onError((message) => reject(new Error(message))),
    )
    try {
      await Promise.race([
        remote.call('download', build, model.contextTokens),
        crashed,
      ])
    } catch (error) {
      // Cancelled: not a problem.
      if (downloader?.handle === handle) {
        const kind = classifyFailure(error)
        update({
          problem: {
            model: id,
            kind: kind === 'memory' || kind === 'network' ? kind : 'other',
            message:
              kind === 'network'
                ? 'The download stopped: check your connection, then pick up where it left off.'
                : error instanceof Error
                  ? error.message
                  : String(error),
          },
        })
      }
    } finally {
      if (downloader?.handle === handle) {
        remote.close()
        handle.terminate()
        downloader = null
        update({ download: null })
      }
      await refresh([id])
    }
  }

  /** Stops a download; what's arrived stays, to pick up from later. */
  async function cancelDownload(): Promise<void> {
    if (!downloader) return
    const { handle, model } = downloader
    downloader = null
    handle.terminate()
    update({ download: null })
    await refresh([model])
  }

  /** Deletes a model's files from this device (both builds). */
  async function remove(id: string): Promise<void> {
    const model = findLocalChatModel(id)
    if (!model) return
    if (runner?.model.id === id) unload()
    if (downloader?.model === id) await cancelDownload()
    for (const build of Object.values(model.builds)) await deps.remove(build)
    const problem = store.get().problem
    if (problem?.model === id) update({ problem: null })
    await refresh([id])
  }

  return {
    store,
    chat,
    download,
    cancelDownload,
    remove,
    unload,
    /** Checks what's downloaded (and the browser's storage), for Settings. */
    refresh,
  }
}

export type LocalChat = ReturnType<typeof createLocalChat>
