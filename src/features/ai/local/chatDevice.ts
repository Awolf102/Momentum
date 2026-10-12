/**
 * The chat model on this device, as Momentum runs it: a module worker with
 * WebLLM, files in Cache Storage, and the browser's storage promises. Loaded
 * only when it's used, or Settings shows it.
 */
import { createLocalChat } from './chat'
import { removeFiles, storedFiles } from './chatCache'
import { localChatStore } from './chatState'
import { checkGpu } from './webgpu'

export const localChat = createLocalChat({
  store: localChatStore,
  startWorker() {
    const worker = new Worker(new URL('./chat.worker.ts', import.meta.url), {
      type: 'module',
      name: 'Momentum chat',
    })
    return {
      port: worker,
      terminate: () => worker.terminate(),
      onError: (listener) =>
        worker.addEventListener('error', (event) => {
          event.preventDefault()
          listener(event.message || 'The model stopped unexpectedly.')
        }),
    }
  },
  gpu: checkGpu,
  stored: (build) => storedFiles(build),
  remove: (build) => removeFiles(build),
  persist: async () => (await navigator.storage?.persist?.()) ?? false,
  persisted: async () => (await navigator.storage?.persisted?.()) ?? false,
  estimate: async () => {
    const estimate = await navigator.storage?.estimate?.()
    return estimate
      ? { usage: estimate.usage ?? 0, quota: estimate.quota ?? 0 }
      : null
  },
})
