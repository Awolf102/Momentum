import { useEffect, useRef, type MouseEvent } from 'react'
import { MarkdownView } from '@/features/notes/view'
import { navigate, paths } from '@/lib/routes'
import { findCitations } from '../lib/prompt'
import { sourceHref, sourceLabel } from '../lib/sources'
import type { SourceRef } from '../types'

/**
 * Turns "[2]" in an answer's text into a link to source 2 (outside code,
 * maths and links). Safe to run again: it only touches text still in
 * brackets.
 */
function linkCitations(root: HTMLElement, sources: readonly SourceRef[]) {
  if (sources.length === 0) return
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode: (node) =>
      node.parentElement?.closest('a, code, pre, .katex, .math-block')
        ? NodeFilter.FILTER_REJECT
        : NodeFilter.FILTER_ACCEPT,
  })
  const nodes: Text[] = []
  while (walker.nextNode()) nodes.push(walker.currentNode as Text)
  for (const node of nodes) {
    const text = node.data
    const citations = findCitations(text, sources.length)
    if (citations.length === 0) continue
    const parts = document.createDocumentFragment()
    let last = 0
    for (const { start, end, numbers } of citations) {
      parts.append(text.slice(last, start))
      for (const number of numbers) {
        const source = sources[number - 1]
        const link = document.createElement('a')
        link.href = sourceHref(source)
        link.dataset.cite = String(number)
        link.title = sourceLabel(source)
        link.textContent = String(number)
        link.className =
          'mx-px inline-flex min-w-[1.35em] -translate-y-px items-center justify-center rounded-md bg-orange-400/15 px-1 align-baseline text-[0.72em] leading-[1.6] font-semibold text-orange-200 no-underline transition hover:bg-orange-400/30 light:text-orange-700'
        parts.append(link)
      }
      last = end
    }
    parts.append(text.slice(last))
    node.replaceWith(parts)
  }
}

/** An answer: markdown, with its citations linking to their sources. */
export function Answer({
  text,
  sources,
}: {
  text: string
  sources: readonly SourceRef[]
}) {
  const ref = useRef<HTMLDivElement>(null)

  // The markdown can render later (its renderer loads on first use), and
  // again as the answer grows: citations are linked whenever it does.
  useEffect(() => {
    const root = ref.current
    if (!root) return
    linkCitations(root, sources)
    const observer = new MutationObserver(() => linkCitations(root, sources))
    observer.observe(root, { childList: true, subtree: true })
    return () => observer.disconnect()
  }, [sources])

  function onClick(event: MouseEvent<HTMLDivElement>) {
    const link = (event.target as Element).closest<HTMLAnchorElement>(
      'a[data-cite]',
    )
    if (
      !link ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    )
      return
    event.preventDefault()
    navigate(link.getAttribute('href') ?? paths.assistant)
  }

  return (
    // Clicks are for the citation links inside, which are focusable.
    <div ref={ref} onClick={onClick}>
      <MarkdownView markdown={text} className="text-[15px]" />
    </div>
  )
}
