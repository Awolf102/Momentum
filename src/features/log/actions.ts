import type { DateKey } from '@/lib/date'
import { navigate, paths } from '@/lib/routes'
import { editorsOnScreen, lineRequestStore } from './store'

/**
 * Opens a day's line for writing: right where it is if it's on screen (the
 * dashboard after checking in), otherwise on the Log page.
 */
export function writeLine(day: DateKey): void {
  lineRequestStore.set(day)
  if (!editorsOnScreen.get(day)) navigate(paths.log)
}
