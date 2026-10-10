import type { SourceText } from '@/features/ai/material'

const plural = (count: number, one: string, many = `${one}s`) =>
  `${count} ${count === 1 ? one : many}`

/**
 * Pages written as in a print dialog ("3-7, 10", "12–"), from 1 to `last`.
 * Blank or "all" is every page; null when it can't be read or goes past
 * the end.
 */
export function parsePages(text: string, last: number): number[] | null {
  const written = text
    .trim()
    .replace(/\s*(?:-|–|—|\bto\b)\s*/gi, '-')
    .toLowerCase()
  if (!written || written === 'all')
    return Array.from({ length: last }, (_, index) => index + 1)
  const pages = new Set<number>()
  for (const piece of written.split(/[\s,;]+/)) {
    if (!piece) continue
    const range = /^(\d+)(?:-(\d+)?)?$/.exec(piece)
    if (!range) return null
    const from = Number(range[1])
    const to = range[2] ? Number(range[2]) : piece.includes('-') ? last : from
    if (from < 1 || to < from || to > last) return null
    for (let page = from; page <= to; page++) pages.add(page)
  }
  return pages.size ? [...pages].sort((a, b) => a - b) : null
}

/** Pages as runs: "1–3, 5, 7–8". */
export function formatPages(pages: readonly number[]): string {
  const runs: string[] = []
  for (let at = 0; at < pages.length;) {
    let end = at
    while (end + 1 < pages.length && pages[end + 1] === pages[end] + 1) end++
    runs.push(end === at ? `${pages[at]}` : `${pages[at]}–${pages[end]}`)
    at = end + 1
  }
  return runs.join(', ')
}

/**
 * Which pages, in words: "All 30 pages", "Pages 3–7", "Page 4", or, for
 * pages picked from all through a long document, "18 of 30 pages".
 */
export function describePages(
  pages: readonly number[],
  total: number | null,
): string {
  if (pages.length === 0) return 'No pages'
  if (total && pages.length === total && total > 1)
    return `All ${plural(total, 'page')}`
  if (pages.length === 1) return `Page ${pages[0]}`
  const runs = formatPages(pages)
  if (runs.split(', ').length <= 4) return `Pages ${runs}`
  return total
    ? `${pages.length} of ${plural(total, 'page')}`
    : plural(pages.length, 'page')
}

/**
 * What of a chosen source goes with a request, in words: "The whole note",
 * "The start of the note", "Pages 3–7", "18 of 30 pages, spread out".
 */
export function describeSent(
  chosen: SourceText,
  sent: SourceText,
  total: number | null,
): string {
  const chars = (source: SourceText) =>
    source.parts.reduce((sum, part) => sum + part.text.trim().length, 0)
  if (sent.parts.length === 0) return 'Not sent: no room left'
  if (chosen.kind === 'note')
    return chars(sent) < chars(chosen)
      ? 'The start of the note'
      : 'The whole note'
  const withText = chosen.parts.filter((part) => part.text.trim())
  const pages = chosen.parts
    .map((part) => part.page)
    .filter((page): page is number => page !== null)
  if (sent.parts.length < withText.length)
    return `${sent.parts.length} of ${plural(withText.length, 'page')}, spread out`
  if (chars(sent) < chars(chosen))
    return `${describePages(pages, total)} (one shortened to fit)`
  return describePages(pages, total)
}
