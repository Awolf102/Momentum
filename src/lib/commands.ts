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
