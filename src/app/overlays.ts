import { createStore } from '@/lib/store'

/** App-level dialogs that aren't owned by a single feature. */
export const paletteOpenStore = createStore(false)
export const shortcutsOpenStore = createStore(false)

export const togglePalette = () => paletteOpenStore.set((open) => !open)
export const closePalette = () => paletteOpenStore.set(false)
export const openShortcuts = () => shortcutsOpenStore.set(true)
export const closeShortcuts = () => shortcutsOpenStore.set(false)
