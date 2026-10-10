import type { Highlight } from '../types'
import { readingOrder } from './rects'

/**
 * A document's highlights as markdown, for a note: each quote with its page,
 * and its margin note under it.
 */
export function highlightsToMarkdown(
  title: string,
  highlights: readonly Highlight[],
): string {
  const blocks = readingOrder(highlights).map((highlight) => {
    const quote = highlight.quote.replace(/\s+/g, ' ').trim().replace(/^/, '> ')
    const note = highlight.note.trim()
    return `${quote}\n> — p. ${highlight.page}${note ? `\n\n${note}` : ''}`
  })
  return [`Highlights from *${title.replace(/\*/g, '')}*.`, ...blocks].join(
    '\n\n',
  )
}
