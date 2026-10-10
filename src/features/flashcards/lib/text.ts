import type { CardDraft } from '../types'

/** A card a model suggested, with the page it's from when it says. */
export interface SuggestedCard {
  front: string
  back: string
  page?: number
}

/** A side longer than this is cut (a card is one idea). */
export const MAX_SIDE = 2000

const LIST_MARKER = /^\s*(?:[-*+]|\d+[.)])\s+(?:\[[ xX]\]\s+)?/

/**
 * Cards written in a note, one a line as "question :: answer". The spaces
 * around "::" matter, so code such as `std::vector` isn't taken for a card;
 * lines in code blocks and maths blocks are left alone.
 */
export function cardsInNote(markdown: string): CardDraft[] {
  const drafts: CardDraft[] = []
  let fence: string | null = null
  let maths = false
  for (const line of markdown.split('\n')) {
    const trimmed = line.trim()
    const opening = /^(`{3,}|~{3,})/.exec(trimmed)
    if (fence) {
      if (trimmed.startsWith(fence)) fence = null
      continue
    }
    if (opening) {
      fence = opening[1]
      continue
    }
    if (trimmed === '$$') {
      maths = !maths
      continue
    }
    if (maths) continue
    const at = line.indexOf(' :: ')
    if (at === -1) continue
    const front = line.slice(0, at).replace(LIST_MARKER, '').trim()
    const back = line.slice(at + 4).trim()
    if (front && back) drafts.push({ front, back })
  }
  return drafts
}

const SIDE_NAMES = {
  front: ['front', 'question', 'q', 'prompt'],
  back: ['back', 'answer', 'a', 'response'],
}

function side(item: Record<string, unknown>, names: string[]): string {
  for (const name of names) {
    const value = item[name]
    if (typeof value === 'string' && value.trim())
      return value.trim().slice(0, MAX_SIDE)
  }
  return ''
}

/** The first JSON list in some text, wherever it starts ("[" may come earlier in prose). */
function jsonList(text: string): unknown[] {
  const end = text.lastIndexOf(']')
  for (
    let start = text.indexOf('['), tries = 0;
    start !== -1 && start < end && tries < 20;
    start = text.indexOf('[', start + 1), tries++
  ) {
    try {
      const value: unknown = JSON.parse(text.slice(start, end + 1))
      if (Array.isArray(value)) return value
    } catch {
      // Not the list's start: try the next "[".
    }
  }
  return []
}

/**
 * The cards in a model's reply: a JSON list of `{ "front", "back" }` (or
 * question and answer), with or without a code fence or words around it.
 * Repeats and half-empty cards are left out.
 */
export function parseSuggestedCards(reply: string): SuggestedCard[] {
  const items = jsonList(reply)
  const seen = new Set<string>()
  const suggested: SuggestedCard[] = []
  for (const item of items) {
    if (typeof item !== 'object' || item === null) continue
    const record = item as Record<string, unknown>
    const front = side(record, SIDE_NAMES.front)
    const back = side(record, SIDE_NAMES.back)
    const key = front.toLowerCase().replace(/\s+/g, ' ')
    if (!front || !back || seen.has(key)) continue
    seen.add(key)
    const { page } = record
    suggested.push(
      typeof page === 'number' && Number.isInteger(page) && page > 0
        ? { front, back, page }
        : { front, back },
    )
  }
  return suggested
}
