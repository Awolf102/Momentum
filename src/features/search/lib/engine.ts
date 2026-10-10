/**
 * Keyword search over everything in Momentum. Text is folded (lowercase,
 * accents removed) and split into words; a query word matches a word that
 * starts with it, so "karn" finds "Karnaugh" and "godel" finds "Gödel".
 * Every query word has to match, in the title or the text.
 */

export interface SearchDoc {
  /** Unique across kinds, e.g. "note:abc". */
  key: string
  title: string
  /** Searched besides the title: plain text, one line per line. */
  text: string
  /** Ties go to the most recently changed. */
  updatedAt: string
  /** Nudges the rank: pinned notes up, finished tasks down. */
  boost?: number
  /** Breaks ties before recency, lowest first (e.g. notes before the log). */
  order?: number
}

/** A document, ready to search: its words, sorted, without repeats. */
export interface IndexedDoc {
  doc: SearchDoc
  titleWords: string[]
  textWords: string[]
  foldedTitle: string
}

/** A run of text, marked if it matched. */
export interface Segment {
  text: string
  match: boolean
}

const WORD = /[\p{L}\p{N}]+/gu
const MARKS = /\p{M}/gu
const isWordChar = (character: string | undefined) =>
  character !== undefined && /[\p{L}\p{N}]/u.test(character)

/** Lowercase, without accents: how text is compared. */
export const fold = (text: string) =>
  text.normalize('NFD').replace(MARKS, '').toLowerCase()

export const wordsOf = (text: string): string[] => fold(text).match(WORD) ?? []

const sortedUnique = (words: string[]) => [...new Set(words)].sort()

export function indexDoc(doc: SearchDoc): IndexedDoc {
  return {
    doc,
    titleWords: sortedUnique(wordsOf(doc.title)),
    textWords: sortedUnique(wordsOf(doc.text)),
    foldedTitle: fold(doc.title).replace(/\s+/g, ' ').trim(),
  }
}

function lowerBound(sorted: readonly string[], word: string): number {
  let low = 0
  let high = sorted.length
  while (low < high) {
    const middle = (low + high) >> 1
    if (sorted[middle] < word) low = middle + 1
    else high = middle
  }
  return low
}

/** 2 for the word itself, 1 for a word starting with it, 0 for neither. */
function strength(sorted: readonly string[], word: string): number {
  const found = sorted[lowerBound(sorted, word)]
  if (found === word) return 2
  // One letter matches only itself, or it would match nearly everything.
  return word.length > 1 && found?.startsWith(word) ? 1 : 0
}

/** The query's words, folded. */
export const queryWords = (query: string) => [...new Set(wordsOf(query))]

/** How well a document matches (higher is better), or null if it doesn't. */
export function score(entry: IndexedDoc, query: string): number | null {
  const words = queryWords(query)
  if (words.length === 0) return null
  let total = 0
  for (const word of words) {
    const inTitle = strength(entry.titleWords, word)
    const inText = strength(entry.textWords, word)
    if (!inTitle && !inText) return null
    // A word in the title counts for more than one in the text.
    total += Math.max(inTitle * 3, inText)
  }
  const phrase = fold(query).replace(/\s+/g, ' ').trim()
  if (entry.foldedTitle === phrase) total += 8
  else if (entry.foldedTitle.startsWith(phrase)) total += 5
  else if (entry.foldedTitle.includes(phrase)) total += 2
  return total + (entry.doc.boost ?? 0)
}

/** The best matches, best first (then by `order`, then the latest). */
export function search(
  entries: readonly IndexedDoc[],
  query: string,
  limit = 50,
): { entry: IndexedDoc; score: number }[] {
  const found: { entry: IndexedDoc; score: number }[] = []
  for (const entry of entries) {
    const value = score(entry, query)
    if (value !== null) found.push({ entry, score: value })
  }
  return found
    .sort(
      (a, b) =>
        b.score - a.score ||
        (a.entry.doc.order ?? 0) - (b.entry.doc.order ?? 0) ||
        (a.entry.doc.updatedAt < b.entry.doc.updatedAt ? 1 : -1),
    )
    .slice(0, limit)
}

/** Folded text, with where each folded character came from. */
function foldWithMap(text: string): { folded: string; from: number[] } {
  let folded = ''
  const from: number[] = []
  for (let index = 0; index < text.length;) {
    const character = String.fromCodePoint(text.codePointAt(index)!)
    const piece = fold(character)
    for (let i = 0; i < piece.length; i++) from.push(index)
    folded += piece
    index += character.length
  }
  from.push(text.length)
  return { folded, from }
}

/** Where the query's words start words in the text: [start, end) pairs. */
function matchesIn(folded: string, words: readonly string[]): number[][] {
  const ranges: number[][] = []
  for (const word of words) {
    for (
      let at = folded.indexOf(word);
      at >= 0;
      at = folded.indexOf(word, at + 1)
    ) {
      if (isWordChar(folded[at - 1])) continue
      if (word.length === 1 && isWordChar(folded[at + 1])) continue
      ranges.push([at, at + word.length])
    }
  }
  ranges.sort((a, b) => a[0] - b[0])
  const merged: number[][] = []
  for (const range of ranges) {
    const last = merged.at(-1)
    if (last && range[0] <= last[1]) last[1] = Math.max(last[1], range[1])
    else merged.push([...range])
  }
  return merged
}

function segmentsOf(
  text: string,
  from: readonly number[],
  ranges: readonly number[][],
  start: number,
  end: number,
): Segment[] {
  const segments: Segment[] = []
  let cursor = start
  const push = (a: number, b: number, match: boolean) => {
    if (b > a) segments.push({ text: text.slice(from[a], from[b]), match })
  }
  for (const [a, b] of ranges) {
    if (b <= start || a >= end) continue
    push(cursor, Math.max(a, cursor), false)
    push(Math.max(a, start), Math.min(b, end), true)
    cursor = Math.min(b, end)
  }
  push(cursor, end, false)
  return segments
}

/** A title with the words that matched marked. */
export function highlight(text: string, query: string): Segment[] {
  const { folded, from } = foldWithMap(text)
  return segmentsOf(
    text,
    from,
    matchesIn(folded, queryWords(query)),
    0,
    folded.length,
  )
}

/** Which line of the text has the first match, or null if none does. */
export function matchingLine(text: string, query: string): number | null {
  const words = queryWords(query)
  if (words.length === 0) return null
  const lines = text.split('\n')
  for (let index = 0; index < lines.length; index++)
    if (matchesIn(fold(lines[index]), words).length > 0) return index
  return null
}

/**
 * The first line of the text with a match, cut to about `length`
 * characters around it, with the matches marked. Null if nothing in the
 * text matched (the title did).
 */
export function snippet(
  text: string,
  query: string,
  length = 110,
): Segment[] | null {
  const words = queryWords(query)
  if (words.length === 0) return null
  for (const line of text.split('\n')) {
    const { folded, from } = foldWithMap(line)
    const ranges = matchesIn(folded, words)
    if (ranges.length === 0) continue
    // Start a little before the first match, at a word.
    let start = Math.max(0, ranges[0][0] - Math.floor(length / 4))
    if (start > 0) {
      const space = folded.indexOf(' ', start)
      start = space >= 0 && space < ranges[0][0] ? space + 1 : ranges[0][0]
    }
    let end = Math.min(folded.length, start + length)
    if (end < folded.length) {
      const space = folded.lastIndexOf(' ', end)
      if (space > ranges[0][1]) end = space
    }
    const segments = segmentsOf(line, from, ranges, start, end)
    if (start > 0) segments.unshift({ text: '…', match: false })
    if (end < folded.length) segments.push({ text: '…', match: false })
    return segments
  }
  return null
}
