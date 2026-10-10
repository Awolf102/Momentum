import { formatDateKey, type DateKey } from '@/lib/date'

/** A line is a sentence or two, not an essay. */
export const MAX_LINE_LENGTH = 200

/**
 * Makes text into one tidy line: line breaks and runs of spaces become single
 * spaces, and it's cut to the maximum length (by character, so an emoji is
 * never split in half).
 */
export function cleanLine(text: string): string {
  const line = text.replace(/\s+/g, ' ').trim()
  const characters = Array.from(line)
  return characters.length > MAX_LINE_LENGTH
    ? characters.slice(0, MAX_LINE_LENGTH).join('').trimEnd()
    : line
}

/** What a day's line field is called, for screen readers. */
export const editorLabel = (day: DateKey): string =>
  `Line for ${formatDateKey(day, { weekday: 'long', month: 'long', day: 'numeric' })}`
