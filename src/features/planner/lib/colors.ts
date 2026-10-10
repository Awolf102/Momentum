import type { CalendarColor } from '../types'

/** Each calendar colour, in the same family as subjects'. */
export const CALENDAR_SWATCHES: Record<CalendarColor, string> = {
  sky: 'oklch(0.76 0.12 230)',
  violet: 'oklch(0.72 0.15 295)',
  emerald: 'oklch(0.76 0.13 160)',
  rose: 'oklch(0.73 0.16 10)',
  amber: 'oklch(0.82 0.15 75)',
  slate: 'oklch(0.72 0.03 260)',
}

/** What each colour is called, for screen readers and the colour button. */
export const CALENDAR_COLOR_NAMES: Record<CalendarColor, string> = {
  sky: 'blue',
  violet: 'purple',
  emerald: 'green',
  rose: 'pink',
  amber: 'yellow',
  slate: 'grey',
}

/** Blocks without a subject: focus and tasks warm, the rest neutral. */
export const FOCUS_SWATCH = 'oklch(0.82 0.15 75)'
export const TASK_SWATCH = 'oklch(0.78 0.15 55)'
export const OTHER_SWATCH = 'oklch(0.72 0.03 260)'
