import { createStore } from '@/lib/store'
import type { StoredFiles } from './chatCache'

/** A model's files on this device. */
export type ModelFiles =
  | { status: 'unknown' }
  | { status: 'absent' }
  /** Some of it: a download that stopped part way, to pick up again. */
  | ({ status: 'partial' } & StoredFiles)
  | ({ status: 'stored' } & StoredFiles)

export interface LocalChatState {
  files: Record<string, ModelFiles>
  download: {
    model: string
    loaded: number
    total: number
    fraction: number
  } | null
  /** The model in the worker: being put on the GPU, or ready. */
  running: {
    model: string
    status: 'loading' | 'ready'
    fraction: number
  } | null
  problem: {
    model: string
    kind: 'memory' | 'network' | 'other'
    message: string
  } | null
  /** Whether the browser promised not to clear Momentum's storage. */
  persisted: boolean | null
  /** Storage Momentum uses, and may use, in bytes. */
  storage: { usage: number; quota: number } | null
}

export const NO_LOCAL_CHAT: LocalChatState = {
  files: {},
  download: null,
  running: null,
  problem: null,
  persisted: null,
  storage: null,
}

/**
 * The chat model on this device: what's downloaded, downloading, running
 * or gone wrong. Kept apart from the code that runs it, so readiness can
 * read it without loading that.
 */
export const localChatStore = createStore<LocalChatState>(NO_LOCAL_CHAT)

/** Whether a model's files are all on this device, as far as is known. */
export function chatModelStored(
  state: LocalChatState,
  id: string,
): boolean | undefined {
  const files = state.files[id]
  if (!files || files.status === 'unknown') return undefined
  return files.status === 'stored'
}
