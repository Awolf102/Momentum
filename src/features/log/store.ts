import type { DateKey } from '@/lib/date'
import { createStore } from '@/lib/store'

/**
 * A request to open a day's line for writing (from the L shortcut or the
 * palette). The editor for that day takes it when it's on screen.
 */
export const lineRequestStore = createStore<DateKey | null>(null)

/** How many editors for each day are on screen right now. */
export const editorsOnScreen = new Map<DateKey, number>()
