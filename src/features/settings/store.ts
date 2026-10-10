import { createStore } from '@/lib/store'

/** Whether the settings sheet is open. */
export const settingsOpenStore = createStore(false)

export const openSettings = () => settingsOpenStore.set(true)
export const closeSettings = () => settingsOpenStore.set(false)
