import { normalizeTitle, withoutCode } from './links'

export interface LinkQuery {
  /** Where the link's text starts (just after "[["). */
  start: number
  /** What's been typed so far. */
  text: string
}

/** The [[link being typed at the caret, if there is one. */
export function linkQueryAt(text: string, caret: number): LinkQuery | null {
  const lineStart = text.lastIndexOf('\n', caret - 1) + 1
  const before = text.slice(lineStart, caret)
  const open = before.lastIndexOf('[[')
  if (open < 0) return null
  const typed = before.slice(open + 2)
  if (/[[\]|]/.test(typed) || typed.length > 80) return null
  const start = lineStart + open + 2
  // Not in code, where [[ is just text — including `code being typed.
  if (withoutCode(text).slice(start - 2, start) !== '[[') return null
  if ((before.slice(0, open).match(/`/g)?.length ?? 0) % 2 === 1) return null
  return { start, text: typed }
}

export interface Suggestion {
  /** What's inserted between the brackets. */
  insert: string
  label: string
  kind: 'note' | 'task'
}

interface Titled {
  title: string
  updatedAt: string
}

const LIMIT = 6

function rank(items: readonly Titled[], typed: string): Titled[] {
  const wanted = normalizeTitle(typed)
  const recent = [...items].sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1))
  if (!wanted) return recent.slice(0, LIMIT)
  const scored = recent.flatMap((item) => {
    const title = normalizeTitle(item.title)
    const at = title.indexOf(wanted)
    if (at < 0) return []
    // The start of the title, then the start of a word, then anywhere.
    const score = at === 0 ? 0 : title[at - 1] === ' ' ? 1 : 2
    return [{ item, score }]
  })
  return scored
    .sort((a, b) => a.score - b.score)
    .slice(0, LIMIT)
    .map(({ item }) => item)
}

/** Notes (or, after "task:", open tasks) whose titles match what's typed. */
export function suggestLinks(
  typed: string,
  options: { notes: readonly Titled[]; tasks: readonly Titled[] },
): Suggestion[] {
  const task = /^task:\s*/i.exec(typed)
  if (task) {
    return rank(
      options.tasks.filter((item) => item.title.trim()),
      typed.slice(task[0].length),
    ).map((item) => ({
      insert: `task:${item.title}`,
      label: item.title,
      kind: 'task',
    }))
  }
  const seen = new Set<string>()
  return rank(
    options.notes.filter((item) => item.title.trim()),
    typed,
  ).flatMap((item) => {
    // Two notes with one title link to the same place: list it once.
    const key = normalizeTitle(item.title)
    if (seen.has(key)) return []
    seen.add(key)
    return [{ insert: item.title, label: item.title, kind: 'note' as const }]
  })
}

/** The element id of one suggestion in the list (for aria-activedescendant). */
export const suggestionId = (listId: string, index: number) =>
  `${listId}-${index}`
