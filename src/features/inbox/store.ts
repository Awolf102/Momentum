import { createStore } from '@/lib/store'

/** The capture dialog (I, ⌘K). */
export const captureOpenStore = createStore(false)
export const openCapture = () => captureOpenStore.set(true)
export const closeCapture = () => captureOpenStore.set(false)
