/**
 * Ranking passages by the words they share with a question (BM25, the
 * classic search-engine formula): rare words count for more than common
 * ones, and a word repeated in a short passage for more than in a long one.
 * Unlike ⌘K's search, a question's words needn't all appear.
 */

/** Words too common to say what a passage is about. */
const STOPWORDS = new Set(
  (
    'a about above after again against all am an and any are as at be because been ' +
    'before being below between both but by can could did do does doing down during ' +
    'each few for from further had has have having he her here hers herself him ' +
    'himself his how i if in into is it its itself just me more most my myself no ' +
    'nor not now of off on once only or other our ours ourselves out over own same ' +
    'she should so some such than that the their theirs them themselves then there ' +
    'these they this those through to too under until up very was we were what when ' +
    'where which while who whom why will with would you your yours yourself ' +
    'yourselves also may might must shall us get got make made much many tell explain ' +
    'please thing things way ways use used using one two'
  ).split(' '),
)

const MARKS = /\p{M}/gu
const WORD = /[\p{L}\p{N}]+/gu

/** A word's rough stem, so "maps" finds "map" and "grouping" finds "group". */
export function stem(word: string): string {
  if (word.length > 4 && /ies$|ied$/.test(word)) return `${word.slice(0, -3)}y`
  if (word.length > 5 && word.endsWith('ing')) return word.slice(0, -3)
  if (word.length > 4 && word.endsWith('ed') && !word.endsWith('eed'))
    return word.slice(0, -2)
  if (word.endsWith('sses')) return word.slice(0, -2)
  if (word.length > 3 && word.endsWith('s') && !/(ss|us|is)$/.test(word))
    return word.slice(0, -1)
  return word
}

/** The words of a text that say what it's about, folded and stemmed. */
export function terms(text: string): string[] {
  const words =
    text.normalize('NFD').replace(MARKS, '').toLowerCase().match(WORD) ?? []
  return words
    .filter((word) => word.length > 1 && !STOPWORDS.has(word))
    .map(stem)
}

/** One item's word counts. */
export interface Counted<T> {
  item: T
  counts: Map<string, number>
  length: number
}

export function countTerms<T>(item: T, text: string): Counted<T> {
  const counts = new Map<string, number>()
  const words = terms(text)
  for (const word of words) counts.set(word, (counts.get(word) ?? 0) + 1)
  return { item, counts, length: words.length }
}

export interface Bm25Index<T> {
  docs: readonly Counted<T>[]
  /** How many items contain each word. */
  frequency: Map<string, number>
  averageLength: number
}

export function buildIndex<T>(docs: readonly Counted<T>[]): Bm25Index<T> {
  const frequency = new Map<string, number>()
  let total = 0
  for (const doc of docs) {
    total += doc.length
    for (const word of doc.counts.keys())
      frequency.set(word, (frequency.get(word) ?? 0) + 1)
  }
  return {
    docs,
    frequency,
    averageLength: docs.length ? total / docs.length : 0,
  }
}

const K1 = 1.2
const B = 0.75

/** The best-matching items for a question, best first. */
export function rank<T>(
  index: Bm25Index<T>,
  question: string,
  limit: number,
  include: (item: T) => boolean = () => true,
): Array<{ item: T; score: number }> {
  const words = [...new Set(terms(question))]
  const count = index.docs.length
  if (words.length === 0 || count === 0) return []
  const weights = words.map((word) => {
    const frequency = index.frequency.get(word) ?? 0
    return Math.log(1 + (count - frequency + 0.5) / (frequency + 0.5))
  })
  const scored: Array<{ item: T; score: number }> = []
  for (const doc of index.docs) {
    if (!include(doc.item)) continue
    let score = 0
    words.forEach((word, i) => {
      const times = doc.counts.get(word)
      if (!times) return
      const norm = 1 - B + (B * doc.length) / (index.averageLength || 1)
      score += (weights[i] * (times * (K1 + 1))) / (times + K1 * norm)
    })
    if (score > 0) scored.push({ item: doc.item, score })
  }
  return scored.sort((a, b) => b.score - a.score).slice(0, limit)
}

/**
 * Combines ranked lists (by words, by meaning) into one: each item scores
 * by its place in each list (reciprocal rank fusion), so an item near the
 * top of both beats one at the top of only one.
 */
export function fuse<T>(
  lists: ReadonlyArray<readonly T[]>,
  keyOf: (item: T) => string,
  k = 60,
): T[] {
  const scores = new Map<string, { item: T; score: number }>()
  for (const list of lists)
    list.forEach((item, place) => {
      const key = keyOf(item)
      const entry = scores.get(key) ?? { item, score: 0 }
      entry.score += 1 / (k + place + 1)
      scores.set(key, entry)
    })
  return [...scores.values()]
    .sort((a, b) => b.score - a.score)
    .map(({ item }) => item)
}
