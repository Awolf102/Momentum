import { createStore } from '@/lib/store'
import type { Precision } from './chatModels'

/** Whether this browser can run a chat model on the GPU. */
export type GpuSupport =
  | { status: 'unknown' }
  | { status: 'checking' }
  /** No WebGPU, or no GPU it can use. There's no CPU fallback for chat. */
  | { status: 'missing'; reason: 'no-webgpu' | 'no-adapter' }
  | {
      status: 'available'
      /** Which builds it can run: 16-bit if the GPU has `shader-f16`. */
      precision: Precision
      /** The largest buffer it allows, in bytes. */
      maxBufferSize: number
    }

export const gpuStore = createStore<GpuSupport>({ status: 'unknown' })

interface GpuLike {
  requestAdapter(options?: {
    powerPreference?: 'high-performance' | 'low-power'
  }): Promise<{
    features: { has(name: string): boolean }
    limits: { maxBufferSize: number }
  } | null>
}

/** Asks the browser for a GPU, once. `gpu` is `navigator.gpu`, passed in for tests. */
export async function detectGpu(
  gpu: GpuLike | undefined = (
    globalThis.navigator as (Navigator & { gpu?: GpuLike }) | undefined
  )?.gpu,
): Promise<GpuSupport> {
  if (!gpu) return { status: 'missing', reason: 'no-webgpu' }
  try {
    const adapter = await gpu.requestAdapter({
      powerPreference: 'high-performance',
    })
    if (!adapter) return { status: 'missing', reason: 'no-adapter' }
    return {
      status: 'available',
      precision: adapter.features.has('shader-f16') ? 'f16' : 'f32',
      maxBufferSize: adapter.limits.maxBufferSize,
    }
  } catch {
    return { status: 'missing', reason: 'no-adapter' }
  }
}

let checking: Promise<GpuSupport> | undefined

/** Checks this browser's GPU (once a page load) and keeps the answer in `gpuStore`. */
export function checkGpu(): Promise<GpuSupport> {
  checking ??= (async () => {
    gpuStore.set({ status: 'checking' })
    const support = await detectGpu()
    gpuStore.set(support)
    return support
  })()
  return checking
}

/** Says, in plain words, why a chat model can't run here. */
export function noGpuMessage(reason: 'no-webgpu' | 'no-adapter'): string {
  return reason === 'no-webgpu'
    ? 'This browser can’t run a chat model on this device: it needs WebGPU, which this browser doesn’t have. Update Safari (WebGPU arrived in Safari 26) or Chrome, or choose another provider.'
    : 'This browser has WebGPU, but couldn’t find a graphics processor it can use (it may be turned off, or unsupported). Update the browser, or choose another provider.'
}
