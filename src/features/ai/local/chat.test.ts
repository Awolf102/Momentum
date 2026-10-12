import { afterEach, describe, expect, it, vi } from 'vitest'
import { emit, expose, type Port } from '@/lib/rpc'
import { createStore } from '@/lib/store'
import type { ChatEvent, ChatRequest } from '../types'
import { CHAT_IDLE_MS, classifyFailure, createLocalChat } from './chat'
import type { GenerateRequest } from './chat.worker'
import type { StoredFiles } from './chatCache'
import { NO_LOCAL_CHAT, type LocalChatState } from './chatState'
import type { GpuSupport } from './webgpu'

/** A stand-in for the chat worker: the same calls and events, scripted. */
interface Script {
  /** What a load does: finish, or fail with an error like WebLLM's. */
  load?: () => Promise<void>
  /** Pieces of the reply, in order. */
  pieces?: string[]
  /** Fails part way, like a GPU that's lost. */
  failAt?: { piece: number; error: Error }
  finish?: string
  /** Download progress events, then done (or a failure). */
  download?: Array<{ fraction: number; loaded: number }>
  downloadError?: Error
  /** The download never finishes on its own. */
  hang?: boolean
}

function errorNamed(name: string, message: string) {
  const error = new Error(message)
  error.name = name
  return error
}

function setup(
  options: {
    gpu?: GpuSupport
    files?: Record<string, StoredFiles>
    script?: Script
  } = {},
) {
  // The test's own object, so it can change the script part way.
  const script: Script = options.script ?? {}
  script.pieces ??= ['Hello', ' there']
  const files: Record<string, StoredFiles> = options.files ?? {
    'Qwen3.5-2B-q4f16_1-MLC': {
      complete: true,
      bytes: 1_100_000_000,
      weightBytes: 1_050_000_000,
      weightFraction: 1,
    },
  }
  const workers: Array<{
    terminated: boolean
    calls: string[]
    requests: GenerateRequest[]
    crash: (message: string) => void
  }> = []
  const store = createStore<LocalChatState>(NO_LOCAL_CHAT)
  const persist = vi.fn(async () => true)
  const removed: string[] = []

  const chat = createLocalChat({
    store,
    startWorker() {
      const channel = new MessageChannel()
      channel.port1.start()
      channel.port2.start()
      const worker = channel.port2 as unknown as Port
      const record = {
        terminated: false,
        calls: [] as string[],
        requests: [] as GenerateRequest[],
        crash: (_message: string) => {},
      }
      let interrupted = false
      expose(
        {
          async download(build: string) {
            record.calls.push(`download ${build}`)
            for (const step of script.download ?? []) {
              await Promise.resolve()
              emit(worker, 'progress', { phase: 'download', ...step })
            }
            if (script.downloadError) throw script.downloadError
            if (script.hang) await new Promise(() => {})
            files[build] = {
              complete: true,
              bytes: 1_100_000_000,
              weightBytes: 1_050_000_000,
              weightFraction: 1,
            }
            return true
          },
          async load(build: string, contextTokens: number) {
            record.calls.push(`load ${build} ${contextTokens}`)
            emit(worker, 'progress', { phase: 'load', fraction: 0.5 })
            await (script.load?.() ?? Promise.resolve())
            return true
          },
          async generate(id: number, request: GenerateRequest) {
            record.calls.push('generate')
            record.requests.push(request)
            interrupted = false
            for (const [index, text] of (script.pieces ?? []).entries()) {
              await new Promise((resolve) => setTimeout(resolve, 1))
              if (script.failAt?.piece === index) throw script.failAt.error
              if (interrupted) return { finish: 'abort' }
              emit(worker, 'chunk', { id, text })
            }
            return {
              finish: script.finish ?? 'stop',
              usage: { inputTokens: 30, outputTokens: 4 },
            }
          },
          interrupt() {
            record.calls.push('interrupt')
            interrupted = true
            return true
          },
        },
        worker,
      )
      workers.push(record)
      return {
        port: channel.port1 as unknown as Port,
        terminate() {
          record.terminated = true
          channel.port1.close()
          channel.port2.close()
        },
        onError(listener) {
          record.crash = listener
        },
      }
    },
    gpu: async () =>
      options.gpu ?? {
        status: 'available',
        precision: 'f16',
        maxBufferSize: 4e9,
      },
    stored: async (build) =>
      files[build] ?? { complete: false, bytes: 0, weightFraction: 0 },
    remove: async (build) => {
      removed.push(build)
      delete files[build]
    },
    persist,
    persisted: async () => true,
    estimate: async () => ({ usage: 1_200_000_000, quota: 60_000_000_000 }),
  })
  return { chat, store, workers, persist, removed, files }
}

const request = (extra: Partial<ChatRequest> = {}): ChatRequest => ({
  model: 'qwen3.5-2b',
  messages: [{ role: 'user', content: 'Hi' }],
  maxTokens: 100,
  thinking: false,
  ...extra,
})

async function collect(stream: AsyncIterable<ChatEvent>) {
  const events: ChatEvent[] = []
  for await (const event of stream) events.push(event)
  return events
}

afterEach(() => vi.useRealTimers())

describe('chat on this device', () => {
  it('says plainly when the browser has no WebGPU, with no CPU fallback', async () => {
    const { chat, workers } = setup({
      gpu: { status: 'missing', reason: 'no-webgpu' },
    })
    await expect(collect(chat.chat(request()))).rejects.toMatchObject({
      kind: 'unsupported',
      message: expect.stringMatching(/needs WebGPU.*Update Safari/),
    })
    await chat.download('qwen3.5-2b').catch(() => {})
    expect(workers).toHaveLength(0)
  })

  it('asks for the model to be downloaded first', async () => {
    const { chat, workers } = setup({ files: {} })
    await expect(collect(chat.chat(request()))).rejects.toMatchObject({
      kind: 'unavailable',
      message:
        'Qwen3.5 2B isn’t on this device yet. Download it in Settings → AI.',
    })
    expect(workers).toHaveLength(0)
  })

  it('loads on first use, streams the reply, and reuses the loaded model', async () => {
    const { chat, workers, store } = setup()
    expect(workers).toHaveLength(0)
    const events = await collect(chat.chat(request()))
    expect(events).toEqual([
      { type: 'text', text: 'Hello' },
      { type: 'text', text: ' there' },
      { type: 'usage', usage: { inputTokens: 30, outputTokens: 4 } },
      { type: 'done', stopReason: 'end' },
    ])
    expect(store.get().running).toMatchObject({
      model: 'qwen3.5-2b',
      status: 'ready',
    })
    await collect(chat.chat(request()))
    expect(workers).toHaveLength(1)
    expect(workers[0].calls.filter((call) => call.startsWith('load'))).toEqual([
      'load Qwen3.5-2B-q4f16_1-MLC 16384',
    ])
  })

  it('passes on the thinking switch and the reply cap, and takes the thinking out', async () => {
    const { chat, workers } = setup({
      script: { pieces: ['<think>', 'Hmm.', '</think>\n\nYes.'] },
    })
    const events = await collect(chat.chat(request({ thinking: true })))
    expect(workers[0].requests[0]).toMatchObject({
      thinking: true,
      maxTokens: 100,
    })
    expect(events.filter((event) => event.type === 'text')).toEqual([
      { type: 'text', text: 'Yes.' },
    ])
    expect(events.some((event) => event.type === 'thinking')).toBe(true)
    await collect(chat.chat(request({ thinking: false })))
    expect(workers[0].requests[1].thinking).toBe(false)
  })

  it('stops writing when cancelled, keeping what came', async () => {
    const { chat, workers } = setup({
      script: { pieces: ['One', ' two', ' three', ' four', ' five'] },
    })
    const controller = new AbortController()
    const text: string[] = []
    const error = await (async () => {
      for await (const event of chat.chat(
        request({ signal: controller.signal }),
      )) {
        if (event.type === 'text') text.push(event.text)
        if (text.length === 2) controller.abort()
      }
    })().catch((caught: unknown) => caught)
    expect(error).toMatchObject({ kind: 'aborted' })
    expect(text).toEqual(['One', ' two'])
    expect(workers[0].calls).toContain('interrupt')
    // The model stays loaded for the next request.
    expect(workers[0].terminated).toBe(false)
  })

  it('says when a reply reached the length limit', async () => {
    const { chat } = setup({ script: { pieces: ['Cut'], finish: 'length' } })
    const events = await collect(chat.chat(request()))
    expect(events.at(-1)).toEqual({ type: 'done', stopReason: 'max-tokens' })
  })

  it('unloads after ten minutes unused, and loads again when asked', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const { chat, workers, store } = setup({ script: { pieces: [] } })
    await collect(chat.chat(request()))
    vi.advanceTimersByTime(CHAT_IDLE_MS - 1000)
    expect(workers[0].terminated).toBe(false)
    vi.advanceTimersByTime(1000)
    expect(workers[0].terminated).toBe(true)
    expect(store.get().running).toBeNull()
    await collect(chat.chat(request()))
    expect(workers).toHaveLength(2)
  })

  it('unloads a model that runs out of memory, and suggests a smaller one', async () => {
    const { chat, workers, store } = setup({
      script: {
        load: async () => {
          throw errorNamed(
            'DeviceLostError',
            'The WebGPU device was lost while loading the model.',
          )
        },
      },
    })
    const error = await collect(chat.chat(request())).catch(
      (caught: unknown) => caught,
    )
    expect(error).toMatchObject({
      kind: 'memory',
      message:
        'Qwen3.5 2B ran out of memory on this device and was unloaded. Try Qwen3.5 0.8B, which needs less.',
    })
    expect(workers[0].terminated).toBe(true)
    expect(store.get()).toMatchObject({
      running: null,
      problem: { model: 'qwen3.5-2b', kind: 'memory' },
    })
  })

  it('handles the GPU being lost part way through a reply', async () => {
    const { chat, workers } = setup({
      script: {
        pieces: ['Half', ' a'],
        failAt: {
          piece: 1,
          error: new Error('Device lost: GPUDevice was destroyed'),
        },
      },
    })
    const text: string[] = []
    const error = await (async () => {
      for await (const event of chat.chat(request()))
        if (event.type === 'text') text.push(event.text)
    })().catch((caught: unknown) => caught)
    expect(text).toEqual(['Half'])
    expect(error).toMatchObject({ kind: 'memory' })
    expect(workers[0].terminated).toBe(true)
  })

  it('treats a worker that crashes as out of memory, and starts afresh', async () => {
    let crash: (message: string) => void = () => {}
    const { chat, workers } = setup({
      script: {
        load: () =>
          new Promise<void>(() => {
            // Never loads: the worker crashes instead.
            setTimeout(() => crash('The model stopped unexpectedly.'), 5)
          }),
      },
    })
    const first = collect(chat.chat(request()))
    await new Promise((resolve) => setTimeout(resolve, 0))
    crash = workers[0].crash
    await expect(first).rejects.toMatchObject({ kind: 'memory' })
    expect(workers[0].terminated).toBe(true)
  })

  it('says a request too long for the model, without unloading it', async () => {
    const { chat, workers } = setup({
      script: {
        pieces: ['x'],
        failAt: {
          piece: 0,
          error: errorNamed(
            'ContextWindowSizeExceededError',
            'Prompt tokens exceed context window size',
          ),
        },
      },
    })
    await expect(collect(chat.chat(request()))).rejects.toMatchObject({
      kind: 'bad-request',
      message: expect.stringMatching(/more than Qwen3\.5 2B can read at once/),
    })
    expect(workers[0].terminated).toBe(false)
  })

  it('reads text only', async () => {
    const { chat } = setup()
    await expect(
      collect(
        chat.chat(
          request({
            messages: [
              {
                role: 'user',
                content: [{ type: 'image', mediaType: 'image/png', data: '' }],
              },
            ],
          }),
        ),
      ),
    ).rejects.toMatchObject({ kind: 'unsupported' })
  })
})

describe('downloading', () => {
  it('downloads with progress, keeps the storage, and frees the GPU after', async () => {
    const { chat, store, workers, persist } = setup({
      files: {},
      script: {
        download: [
          { fraction: 0.25, loaded: 275_000_000 },
          { fraction: 0.5, loaded: 550_000_000 },
        ],
      },
    })
    const seen: number[] = []
    store.subscribe(() => {
      const download = store.get().download
      if (download) seen.push(download.fraction)
    })
    await chat.download('qwen3.5-2b')
    expect(persist).toHaveBeenCalled()
    expect(seen).toEqual(expect.arrayContaining([0, 0.25, 0.5]))
    expect(workers[0].calls).toEqual(['download Qwen3.5-2B-q4f16_1-MLC'])
    // Done: the worker goes, so nothing stays on the GPU.
    expect(workers[0].terminated).toBe(true)
    expect(store.get()).toMatchObject({
      download: null,
      persisted: true,
      files: { 'qwen3.5-2b': { status: 'stored', bytes: 1_100_000_000 } },
      storage: { usage: 1_200_000_000, quota: 60_000_000_000 },
    })
  })

  it('keeps what came when a download stops, to pick up again', async () => {
    const setupOptions = {
      files: {},
      script: {
        download: [{ fraction: 0.4, loaded: 440_000_000 }],
        downloadError: new TypeError('Failed to fetch'),
      },
    }
    const { chat, store, files } = setup(setupOptions)
    files['Qwen3.5-2B-q4f16_1-MLC'] = {
      complete: false,
      bytes: 440_000_000,
      weightBytes: 1_050_000_000,
      weightFraction: 0.4,
    }
    await chat.download('qwen3.5-2b')
    expect(store.get()).toMatchObject({
      download: null,
      problem: { model: 'qwen3.5-2b', kind: 'network' },
      files: { 'qwen3.5-2b': { status: 'partial', weightFraction: 0.4 } },
    })
    // Resuming is downloading again: the shards already here are kept.
    delete (setupOptions.script as Script).downloadError
    await chat.download('qwen3.5-2b')
    expect(store.get()).toMatchObject({
      problem: null,
      files: { 'qwen3.5-2b': { status: 'stored' } },
    })
  })

  it('cancels a download, and removes a model', async () => {
    const { chat, store, workers, removed, files } = setup({
      files: {},
      script: { download: [{ fraction: 0.1, loaded: 1 }], hang: true },
    })
    void chat.download('qwen3.5-2b')
    await vi.waitFor(() => expect(store.get().download?.fraction).toBe(0.1))
    files['Qwen3.5-2B-q4f16_1-MLC'] = {
      complete: false,
      bytes: 110_000_000,
      weightFraction: 0.1,
    }
    await chat.cancelDownload()
    expect(workers[0].terminated).toBe(true)
    expect(store.get()).toMatchObject({
      download: null,
      files: { 'qwen3.5-2b': { status: 'partial' } },
    })
    await chat.remove('qwen3.5-2b')
    expect(removed).toEqual([
      'Qwen3.5-2B-q4f16_1-MLC',
      'Qwen3.5-2B-q4f32_1-MLC',
    ])
    expect(store.get().files['qwen3.5-2b']).toEqual({ status: 'absent' })
  })

  it('removes a model that’s loaded, unloading it first', async () => {
    const { chat, store, workers } = setup()
    await collect(chat.chat(request()))
    await chat.remove('qwen3.5-2b')
    expect(workers[0].terminated).toBe(true)
    expect(store.get().running).toBeNull()
  })

  it('picks the 32-bit build for a GPU without 16-bit numbers', async () => {
    const { chat, workers } = setup({
      gpu: { status: 'available', precision: 'f32', maxBufferSize: 1e9 },
      files: {
        'Qwen3.5-0.8B-q4f32_1-MLC': {
          complete: true,
          bytes: 1,
          weightFraction: 1,
        },
      },
    })
    await collect(chat.chat(request({ model: 'qwen3.5-0.8b' })))
    expect(workers[0].calls[0]).toBe('load Qwen3.5-0.8B-q4f32_1-MLC 16384')
  })
})

describe('telling failures apart', () => {
  it('sorts WebLLM’s and the browser’s errors', () => {
    expect(classifyFailure(errorNamed('DeviceLostError', 'x'))).toBe('memory')
    expect(classifyFailure(new Error('Out of memory'))).toBe('memory')
    expect(classifyFailure(new Error('Failed to allocate buffer'))).toBe(
      'memory',
    )
    expect(
      classifyFailure(errorNamed('ContextWindowSizeExceededError', 'x')),
    ).toBe('too-long')
    expect(classifyFailure(errorNamed('WebGPUNotAvailableError', 'x'))).toBe(
      'unsupported',
    )
    expect(classifyFailure(new TypeError('Failed to fetch'))).toBe('network')
    expect(classifyFailure(new Error('Something else'))).toBe('other')
  })
})
