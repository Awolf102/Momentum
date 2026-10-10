import type { ReactNode } from 'react'
import type { Hotkey } from './hotkeys'

export interface Command {
  id: string
  title: string
  section: string
  icon?: ReactNode
  /** Extra words that should match a search (synonyms). */
  keywords?: string[]
  hotkey?: Hotkey
  run: () => void
}

/** A run of text, marked if it matched the search. */
export interface MarkedText {
  text: string
  match: boolean
}

/** Something found by searching (a note, a task…), shown under the commands. */
export interface PaletteResult {
  id: string
  /** The group it's listed under, e.g. "Notes". */
  section: string
  icon?: ReactNode
  /** Its name, with the matched words marked. */
  title: readonly MarkedText[]
  /** A line of context from its text, with the matches marked. */
  snippet?: readonly MarkedText[]
  /** A detail on the right, e.g. a due date. */
  detail?: string
  run: () => void
}

/** Every query word must appear somewhere; titles starting with the query rank first. */
export function filterCommands(
  commands: readonly Command[],
  query: string,
): Command[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean)
  if (words.length === 0) return [...commands]
  return commands
    .map((command) => {
      const title = command.title.toLowerCase()
      const haystack = [title, command.section, ...(command.keywords ?? [])]
        .join(' ')
        .toLowerCase()
      if (!words.every((word) => haystack.includes(word))) return null
      const score = title.startsWith(words[0])
        ? 0
        : title.includes(words[0])
          ? 1
          : 2
      return { command, score }
    })
    .filter((match) => match !== null)
    .sort((a, b) => a.score - b.score)
    .map((match) => match.command)
}
