/**
 * Links between notes are written [[Title]] (or [[Title|shown text]]), and
 * links to tasks [[task:Title]]. Nothing inside code counts.
 */

export interface WikiLink {
  kind: 'note' | 'task'
  /** The title linked to, as written. */
  target: string
  /** What the reader sees. */
  label: string
}

const LINK = /\[\[([^\][\n]+?)\]\]/g

/** Lowercase, single spaces: how titles are compared. */
export const normalizeTitle = (title: string) =>
  title.trim().replace(/\s+/g, ' ').toLowerCase()

/** One `[[…]]`'s contents as a link. */
export function parseLink(inner: string): WikiLink | null {
  const [rawTarget, rawLabel] = inner.split('|')
  let target = rawTarget.trim()
  let kind: WikiLink['kind'] = 'note'
  const task = /^task:\s*/i.exec(target)
  if (task) {
    kind = 'task'
    target = target.slice(task[0].length).trim()
  }
  if (!target) return null
  return { kind, target, label: rawLabel?.trim() || target }
}

/** Markdown with code (fenced and inline) blanked out, same length. */
export function withoutCode(markdown: string): string {
  return markdown
    .replace(/^(```|~~~)[^\n]*\n[\s\S]*?(^\1[^\n]*$|(?![\s\S]))/gm, (block) =>
      block.replace(/[^\n]/g, ' '),
    )
    .replace(/`[^`\n]+`/g, (code) => ' '.repeat(code.length))
}

/** Every link in a note's body, in order. */
export function extractLinks(markdown: string): WikiLink[] {
  const links: WikiLink[] = []
  for (const match of withoutCode(markdown).matchAll(LINK)) {
    const link = parseLink(match[1])
    if (link) links.push(link)
  }
  return links
}

/**
 * The notes that link to `title`, as [id, the line the link is on] pairs —
 * for "Linked from" under a note.
 */
export function backlinks(
  title: string,
  notes: readonly { id: string; title: string; body: string }[],
): { id: string; context: string }[] {
  const wanted = normalizeTitle(title)
  if (!wanted) return []
  const found: { id: string; context: string }[] = []
  for (const note of notes) {
    if (normalizeTitle(note.title) === wanted) continue
    const lines = note.body.split('\n')
    const code = withoutCode(note.body).split('\n')
    const index = code.findIndex((line) =>
      [...line.matchAll(LINK)].some((match) => {
        const link = parseLink(match[1])
        return link?.kind === 'note' && normalizeTitle(link.target) === wanted
      }),
    )
    if (index >= 0)
      found.push({ id: note.id, context: lines[index].trim().slice(0, 160) })
  }
  return found
}

/**
 * Rewrites links to a note that was renamed, keeping any shown text:
 * [[Old]] → [[New]], [[Old|text]] → [[New|text]]. Code is left alone.
 */
export function renameLinks(
  markdown: string,
  from: string,
  to: string,
): string {
  const wanted = normalizeTitle(from)
  if (!wanted || !to.trim()) return markdown
  const blanked = withoutCode(markdown)
  let result = ''
  let last = 0
  for (const match of blanked.matchAll(LINK)) {
    const link = parseLink(match[1])
    if (link?.kind !== 'note' || normalizeTitle(link.target) !== wanted)
      continue
    const start = match.index!
    const original = markdown.slice(start, start + match[0].length)
    const label = original.includes('|')
      ? `|${original.slice(original.indexOf('|') + 1, -2)}`
      : ''
    result += `${markdown.slice(last, start)}[[${to.trim()}${label}]]`
    last = start + match[0].length
  }
  return result + markdown.slice(last)
}
