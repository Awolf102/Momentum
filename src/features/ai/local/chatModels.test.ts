import { prebuiltAppConfig } from '@mlc-ai/web-llm'
import { describe, expect, it } from 'vitest'
import { buildLibUrl, buildUrl, removeFiles, storedFiles } from './chatCache'
import {
  DEFAULT_LOCAL_CHAT_MODEL,
  findLocalChatModel,
  LOCAL_CHAT_MODELS,
  smallerChatModel,
} from './chatModels'
import { readProgress } from './chatProgress'
import { detectGpu, noGpuMessage } from './webgpu'

describe('the models on this device', () => {
  it('are builds WebLLM has, from Hugging Face, with its code', () => {
    for (const model of LOCAL_CHAT_MODELS)
      for (const precision of ['f16', 'f32'] as const) {
        const build = model.builds[precision]
        const record = prebuiltAppConfig.model_list.find(
          (each) => each.model_id === build,
        )
        expect(record, build).toBeDefined()
        expect(record!.model).toBe(`https://huggingface.co/mlc-ai/${build}`)
        expect(record!.model_lib).toBe(buildLibUrl(build))
        // Momentum's figure allows for its longer context.
        expect(model.memoryBytes[precision]).toBeGreaterThan(
          record!.vram_required_MB! * 1e6,
        )
      }
  })

  it('offer 0.8B, 2B (the default, recommended for 8 GB) and 4B (with a warning)', () => {
    expect(LOCAL_CHAT_MODELS.map((model) => model.name)).toEqual([
      'Qwen3.5 0.8B',
      'Qwen3.5 2B',
      'Qwen3.5 4B',
    ])
    expect(findLocalChatModel(DEFAULT_LOCAL_CHAT_MODEL)?.recommended).toBe(true)
    expect(findLocalChatModel('qwen3.5-4b')?.caution).toMatch(/8 GB/)
    expect(smallerChatModel('qwen3.5-4b')?.name).toBe('Qwen3.5 2B')
    expect(smallerChatModel('qwen3.5-0.8b')).toBeUndefined()
  })
})

describe('reading WebLLM’s progress', () => {
  it('tells downloading from loading, with bytes', () => {
    expect(
      readProgress({
        progress: 0.25,
        text: 'Fetching param cache[10/40]: 262MB fetched. 25% completed, 12 secs elapsed.',
      }),
    ).toEqual({
      phase: 'download',
      fraction: 0.25,
      loaded: 262 * 1024 * 1024,
      total: Math.round((262 * 1024 * 1024) / 0.25),
    })
    expect(
      readProgress({
        progress: 0.5,
        text: 'Loading model from cache[20/40]: 500MB loaded. 50% completed, 3 secs elapsed.',
      }),
    ).toEqual({ phase: 'load', fraction: 0.5 })
    expect(
      readProgress({ progress: 0, text: 'Start to fetch params' }),
    ).toMatchObject({ phase: 'download', fraction: 0 })
    expect(
      readProgress({ progress: 1, text: 'Finish loading on WebGPU' }),
    ).toBeNull()
  })
})

/** A stand-in for Cache Storage, keyed by URL. */
function fakeCaches(entries: Record<string, Record<string, string | object>>) {
  const stores = new Map(
    Object.entries(entries).map(([name, files]) => [
      name,
      new Map(Object.entries(files)),
    ]),
  )
  return {
    stores,
    async has(name: string) {
      return stores.has(name)
    },
    async open(name: string) {
      const files = stores.get(name) ?? new Map()
      stores.set(name, files)
      return {
        async keys() {
          return [...files.keys()].map((url) => new Request(url))
        },
        async match(key: string | Request) {
          const url = typeof key === 'string' ? key : key.url
          const body = files.get(url)
          if (body === undefined) return undefined
          const text = typeof body === 'string' ? body : JSON.stringify(body)
          return new Response(text, {
            headers: { 'content-length': String(text.length) },
          })
        },
        async delete(key: Request) {
          return files.delete(key.url)
        },
      } as unknown as Cache
    },
  }
}

describe('a model’s files', () => {
  const build = 'Qwen3.5-2B-q4f16_1-MLC'
  const base = buildUrl(build)
  const list = {
    records: [
      { dataPath: 'params_shard_0.bin', nbytes: 6 },
      { dataPath: 'params_shard_1.bin', nbytes: 4 },
    ],
  }
  const everything = () => ({
    'webllm/model': {
      [`${base}tensor-cache.json`]: list,
      [`${base}params_shard_0.bin`]: 'aaaaaa',
      [`${base}params_shard_1.bin`]: 'bbbb',
      [`${base}tokenizer.json`]: '{}',
      // Another model's: left alone.
      [`${buildUrl('Qwen3.5-4B-q4f16_1-MLC')}params_shard_0.bin`]: 'cc',
    },
    'webllm/config': { [`${base}mlc-chat-config.json`]: '{}' },
    'webllm/wasm': { [buildLibUrl(build)]: 'wasm' },
  })

  it('are all here, with their size', async () => {
    const found = await storedFiles(build, fakeCaches(everything()))
    expect(found).toMatchObject({
      complete: true,
      weightBytes: 10,
      weightFraction: 1,
    })
    expect(found.bytes).toBeGreaterThan(10)
  })

  it('are partly here after a download stopped', async () => {
    const files = everything()
    delete (files['webllm/model'] as Record<string, unknown>)[
      `${base}params_shard_0.bin`
    ]
    const found = await storedFiles(build, fakeCaches(files))
    expect(found).toMatchObject({ complete: false, weightFraction: 0.4 })
    expect(await storedFiles(build, fakeCaches({}))).toEqual({
      complete: false,
      bytes: 0,
      weightFraction: 0,
    })
  })

  it('are removed, and only they', async () => {
    const caches = fakeCaches(everything())
    await removeFiles(build, caches)
    expect([...caches.stores.get('webllm/model')!.keys()]).toEqual([
      `${buildUrl('Qwen3.5-4B-q4f16_1-MLC')}params_shard_0.bin`,
    ])
    expect(caches.stores.get('webllm/wasm')!.size).toBe(0)
    expect(caches.stores.get('webllm/config')!.size).toBe(0)
  })
})

describe('WebGPU', () => {
  const adapter = (features: string[]) => ({
    features: new Set(features),
    limits: { maxBufferSize: 4e9 },
  })

  it('is missing, or has no GPU it can use', async () => {
    expect(await detectGpu(undefined)).toEqual({
      status: 'missing',
      reason: 'no-webgpu',
    })
    expect(await detectGpu({ requestAdapter: async () => null })).toEqual({
      status: 'missing',
      reason: 'no-adapter',
    })
    expect(
      await detectGpu({
        requestAdapter: async () => {
          throw new Error('denied')
        },
      }),
    ).toEqual({ status: 'missing', reason: 'no-adapter' })
    expect(noGpuMessage('no-webgpu')).toMatch(
      /Update Safari .* or Chrome, or choose another provider/,
    )
  })

  it('runs 16-bit builds where the GPU can, 32-bit otherwise', async () => {
    expect(
      await detectGpu({ requestAdapter: async () => adapter(['shader-f16']) }),
    ).toEqual({ status: 'available', precision: 'f16', maxBufferSize: 4e9 })
    expect(
      await detectGpu({ requestAdapter: async () => adapter([]) }),
    ).toMatchObject({ precision: 'f32' })
  })
})
