/// <reference lib="webworker" />
/**
 * Runs a chat model in the browser, off the main thread: WebLLM, on the
 * GPU through WebGPU. The page asks for one build at a time; its files come
 * from Cache Storage once downloaded (see `chatCache.ts`). The page stops
 * this worker to free the GPU's memory: after a while unused, when the
 * model runs out of memory, or once a download is done.
 */
import {
  MLCEngine,
  prebuiltAppConfig,
  type AppConfig,
  type ChatCompletionMessageParam,
} from '@mlc-ai/web-llm'
import { emit, expose, type Port } from '@/lib/rpc'
import { readProgress } from './chatProgress'
import { MODEL_HOST } from './models'

const port = self as unknown as Port

/** WebLLM's builds, with their files from a copy of our own if there is one. */
const appConfig: AppConfig = {
  ...prebuiltAppConfig,
  model_list: prebuiltAppConfig.model_list.map((record) => ({
    ...record,
    model: record.model.replace('https://huggingface.co', MODEL_HOST),
  })),
}

let engine: MLCEngine | null = null
let loaded = ''
let loading: Promise<void> | null = null
/** Called when a load moves from downloading to putting it on the GPU. */
let downloaded: (() => void) | null = null

function engineFor(): MLCEngine {
  engine ??= new MLCEngine({
    appConfig,
    initProgressCallback: (report) => {
      const progress = readProgress(report)
      if (!progress) return
      if (progress.phase === 'load') downloaded?.()
      emit(port, 'progress', progress)
    },
  })
  return engine
}

function load(build: string, contextTokens: number): Promise<void> {
  if (loaded === build && loading) return loading
  loaded = build
  const started = engineFor().reload(build, {
    context_window_size: contextTokens,
  })
  loading = started
  // A failed load is tried again next time.
  started.catch(() => {
    if (loading === started) {
      loading = null
      loaded = ''
    }
  })
  return started
}

export interface GenerateRequest {
  system?: string
  messages: Array<{ role: 'user' | 'assistant'; content: string }>
  maxTokens: number
  thinking: boolean
}

export interface GenerateResult {
  /** WebLLM's finish reason: stop, length, abort… */
  finish: string | null
  usage?: { inputTokens: number; outputTokens: number }
}

const handlers = {
  /**
   * Downloads a build's files into Cache Storage, and returns as soon as
   * they're all here, before they go onto the GPU. The page then stops this
   * worker, which is what frees the GPU.
   */
  async download(build: string, contextTokens: number) {
    const done = new Promise<void>((resolve) => (downloaded = resolve))
    await Promise.race([done, load(build, contextTokens)])
    downloaded = null
    return true
  },

  /** Puts a build on the GPU (downloading what isn't here yet). */
  async load(build: string, contextTokens: number) {
    await load(build, contextTokens)
    return true
  },

  /** Writes a reply, sending each piece as a `chunk` event with this id. */
  async generate(
    id: number,
    request: GenerateRequest,
  ): Promise<GenerateResult> {
    if (!engine || !loading) throw new Error('The model isn’t loaded.')
    await loading
    const messages: ChatCompletionMessageParam[] = [
      ...(request.system
        ? [{ role: 'system' as const, content: request.system }]
        : []),
      ...request.messages,
    ]
    const stream = await engine.chat.completions.create({
      messages,
      stream: true,
      stream_options: { include_usage: true },
      max_tokens: request.maxTokens,
      extra_body: { enable_thinking: request.thinking },
    })
    let finish: string | null = null
    let usage: GenerateResult['usage']
    for await (const chunk of stream) {
      const choice = chunk.choices[0]
      if (choice?.delta?.content)
        emit(port, 'chunk', { id, text: choice.delta.content })
      if (choice?.finish_reason) finish = choice.finish_reason
      if (chunk.usage)
        usage = {
          inputTokens: chunk.usage.prompt_tokens,
          outputTokens: chunk.usage.completion_tokens,
        }
    }
    return { finish, usage }
  },

  /** Stops the reply being written; it ends as stopped. */
  interrupt() {
    engine?.interruptGenerate()
    return true
  },
}

export type ChatWorker = typeof handlers

expose(handlers, port)
