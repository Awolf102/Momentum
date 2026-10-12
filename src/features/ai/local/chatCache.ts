/**
 * A chat model's files on this device. WebLLM keeps them in Cache Storage,
 * one entry per file: its weights in shards (so an interrupted download
 * picks up from the last whole shard), the tokenizer, its settings and the
 * code that runs it. This reads and removes them by their addresses,
 * without loading WebLLM, so Settings can say what's here.
 */
import { MODEL_HOST } from './models'

/** WebLLM's cache names (its "cache" backend). */
export const CHAT_CACHES = {
  model: 'webllm/model',
  config: 'webllm/config',
  wasm: 'webllm/wasm',
} as const

/** Where WebLLM's code for its models comes from (its `modelLibURLPrefix` and `modelVersion`). */
export const MODEL_LIB_BASE =
  'https://raw.githubusercontent.com/mlc-ai/binary-mlc-llm-libs/main/web-llm-models/v0_2_86/base/'

/** Where a build's files are: Hugging Face, or a copy at the same paths (`VITE_MODEL_HOST`). */
export function buildUrl(build: string): string {
  return `${MODEL_HOST}/mlc-ai/${build}/resolve/main/`
}

/** The code that runs a build, e.g. `Qwen3.5-2B-q4f16_1_cs1k-webgpu.wasm`. */
export function buildLibUrl(build: string): string {
  return `${MODEL_LIB_BASE}${build.replace(/-MLC$/, '')}_cs1k-webgpu.wasm`
}

export interface StoredFiles {
  /** Every file it needs is here: it can run offline. */
  complete: boolean
  /** Bytes it takes on this device now. */
  bytes: number
  /** The weights' size, once their list has arrived (the start of a download). */
  weightBytes?: number
  /** How much of the weights is here, 0 to 1. */
  weightFraction: number
}

interface TensorCache {
  records?: Array<{ dataPath?: string; nbytes?: number }>
}

type CacheStore = Pick<CacheStorage, 'open' | 'has'>

async function sizeOf(response: Response): Promise<number> {
  const length = Number(response.headers.get('content-length'))
  if (Number.isFinite(length) && length > 0) return length
  return (await response.blob()).size
}

/** What's on this device of a build. */
export async function storedFiles(
  build: string,
  store: CacheStore | undefined = globalThis.caches,
): Promise<StoredFiles> {
  const empty = { complete: false, bytes: 0, weightFraction: 0 }
  if (!store) return empty
  const base = buildUrl(build)
  const lib = buildLibUrl(build)
  let bytes = 0
  const have = new Set<string>()
  for (const name of Object.values(CHAT_CACHES)) {
    if (!(await store.has(name))) continue
    const cache = await store.open(name)
    for (const request of await cache.keys()) {
      if (!request.url.startsWith(base) && request.url !== lib) continue
      const response = await cache.match(request)
      if (!response) continue
      have.add(request.url)
      bytes += await sizeOf(response)
    }
  }
  const listUrl = new URL('tensor-cache.json', base).href
  if (!have.has(listUrl)) return { ...empty, bytes }
  const list = (await (
    await (await store.open(CHAT_CACHES.model)).match(listUrl)
  )?.json()) as TensorCache | undefined
  const shards = (list?.records ?? []).filter((shard) => shard.dataPath)
  const weightBytes = shards.reduce(
    (sum, shard) => sum + (shard.nbytes ?? 0),
    0,
  )
  const here = shards.filter((shard) =>
    have.has(new URL(shard.dataPath!, base).href),
  )
  const hereBytes = here.reduce((sum, shard) => sum + (shard.nbytes ?? 0), 0)
  const complete =
    shards.length > 0 &&
    here.length === shards.length &&
    have.has(lib) &&
    have.has(new URL('mlc-chat-config.json', base).href) &&
    have.has(new URL('tokenizer.json', base).href)
  return {
    complete,
    bytes,
    weightBytes,
    weightFraction: weightBytes > 0 ? hereBytes / weightBytes : 0,
  }
}

/** Deletes a build's files from this device. */
export async function removeFiles(
  build: string,
  store: CacheStore | undefined = globalThis.caches,
): Promise<void> {
  if (!store) return
  const base = buildUrl(build)
  const lib = buildLibUrl(build)
  for (const name of Object.values(CHAT_CACHES)) {
    if (!(await store.has(name))) continue
    const cache = await store.open(name)
    for (const request of await cache.keys())
      if (request.url.startsWith(base) || request.url === lib)
        await cache.delete(request)
  }
}
