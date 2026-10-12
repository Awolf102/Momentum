// What AI features send from your notes and documents, and reading the
// JSON that comes back. Its own entry point: only the lazy pages that make
// cards or quizzes use it, so it stays out of the first load.

/** Text from a note, or some of a document's pages, as it's sent. */
export interface SourceText {
  kind: 'note' | 'document'
  title: string
  parts: ReadonlyArray<{ page: number | null; text: string }>
}

export interface Fitted {
  source: SourceText
  /** Whether some of it was left out. */
  cut: boolean
  /** How much is sent. */
  characters: number
}

/** At most this much text goes with a request (about 6,000 tokens). */
export const MAX_SOURCE_CHARS = 24_000

/** Leftover room smaller than this isn't worth a shortened part. */
const MIN_SHORTENED = 1000

/** About how many tokens some text is (a rough four characters each). */
export const estimateTokens = (characters: number) => Math.ceil(characters / 4)

/**
 * The source as it's sent: whole pages, in order, up to the limit. `cut`
 * says whether some were left out.
 */
export function fitSource(
  source: SourceText,
  limit: number = MAX_SOURCE_CHARS,
): Fitted {
  const parts: Array<{ page: number | null; text: string }> = []
  let characters = 0
  for (const part of source.parts) {
    const text = part.text.trim()
    if (!text) continue
    if (characters + text.length > limit) {
      // A first part longer than the limit is shortened, not dropped.
      if (parts.length === 0) {
        const start = text.slice(0, limit)
        parts.push({ page: part.page, text: start })
        characters = start.length
      }
      return { source: { ...source, parts }, cut: true, characters }
    }
    parts.push({ page: part.page, text })
    characters += text.length
  }
  return { source: { ...source, parts }, cut: false, characters }
}

/**
 * Positions 0 to count − 1 in an order that covers them evenly: the first,
 * the middle, the quarters, the eighths…
 */
export function spreadOrder(count: number): number[] {
  const order: number[] = []
  const taken = new Uint8Array(count)
  for (let step = 1; order.length < count; step *= 2) {
    for (let at = 0; at < step; at++) {
      const index = Math.floor((at * count) / step)
      if (!taken[index]) {
        taken[index] = 1
        order.push(index)
      }
    }
  }
  return order
}

/** Text cut to at most `max` characters, at a paragraph or word break. */
function shorten(text: string, max: number): string {
  const start = text.slice(0, max)
  const paragraph = start.lastIndexOf('\n\n')
  if (paragraph > max * 0.6) return start.slice(0, paragraph).trimEnd()
  const space = start.search(/\s\S*$/)
  return (space > max * 0.6 ? start.slice(0, space) : start).trimEnd()
}

/**
 * Several sources sent together, in the same order (one may end up with no
 * parts). When they don't all fit, whole pages are taken from all through
 * them rather than from the start, so what's made covers everything chosen;
 * room left over goes to a part too long to fit, shortened.
 */
export function spreadSources(
  sources: readonly SourceText[],
  limit: number = MAX_SOURCE_CHARS,
): { sources: SourceText[]; cut: boolean; characters: number } {
  const parts = sources.flatMap((source, at) =>
    source.parts
      .map((part) => ({ at, page: part.page, text: part.text.trim() }))
      .filter((part) => part.text),
  )
  const total = parts.reduce((sum, part) => sum + part.text.length, 0)
  const taken = new Map<number, string>()
  if (total <= limit)
    parts.forEach((part, index) => taken.set(index, part.text))
  else {
    let left = limit
    let skipped: number | null = null
    for (const index of spreadOrder(parts.length)) {
      const { text } = parts[index]
      if (text.length <= left) {
        taken.set(index, text)
        left -= text.length
      } else skipped ??= index
    }
    if (skipped !== null && left >= Math.min(MIN_SHORTENED, limit))
      taken.set(skipped, shorten(parts[skipped].text, left))
  }
  let characters = 0
  const chosen = sources.map((source) => ({
    ...source,
    parts: [] as Array<{ page: number | null; text: string }>,
  }))
  parts.forEach((part, index) => {
    const text = taken.get(index)
    if (text === undefined) return
    chosen[part.at].parts.push({ page: part.page, text })
    characters += text.length
  })
  return { sources: chosen, cut: characters < total, characters }
}

/** A source's text as it goes in a request, each page marked. */
export function sourceBody(source: SourceText): string {
  return source.parts
    .map((part) =>
      part.page ? `[page ${part.page}]\n${part.text}` : part.text,
    )
    .join('\n\n')
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/** The first JSON list in some text, wherever it starts ("[" may come earlier in prose). */
export function jsonList(text: string): unknown[] {
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
 * The objects in a reply's JSON list, even when the reply was cut off part
 * way (it ran out of room): each whole object is kept, the unfinished one
 * left out.
 */
export function jsonItems(text: string): Array<Record<string, unknown>> {
  const whole = jsonList(text).filter(isObject)
  if (whole.length > 0) return whole
  const start = text.search(/\[\s*\{/)
  if (start === -1) return []
  const items: Array<Record<string, unknown>> = []
  let depth = 0
  let from = -1
  let inString = false
  for (let at = start; at < text.length; at++) {
    const char = text[at]
    if (inString) {
      if (char === '\\') at++
      else if (char === '"') inString = false
      continue
    }
    if (char === '"') inString = true
    else if (char === '[' || char === '{') {
      if (depth === 1 && char === '{') from = at
      depth++
    } else if (char === ']' || char === '}') {
      depth--
      if (depth === 1 && char === '}' && from !== -1) {
        try {
          const value: unknown = JSON.parse(text.slice(from, at + 1))
          if (isObject(value)) items.push(value)
        } catch {
          // Not valid JSON: leave it out.
        }
        from = -1
      }
      if (depth <= 0) break
    }
  }
  return items
}

/** The first JSON object in some text, with or without a fence or prose around it. */
export function jsonObject(text: string): Record<string, unknown> | null {
  const end = text.lastIndexOf('}')
  for (
    let start = text.indexOf('{'), tries = 0;
    start !== -1 && start < end && tries < 20;
    start = text.indexOf('{', start + 1), tries++
  ) {
    try {
      const value: unknown = JSON.parse(text.slice(start, end + 1))
      if (isObject(value)) return value
    } catch {
      // Not the object's start: try the next "{".
    }
  }
  return null
}

/**
 * A JSON object from a reply that was cut off part way (it ran out of
 * room): the object closed where it stopped, keeping what came, with the
 * last value as far as it got. Null when there's no object to close.
 */
export function cutOffObject(text: string): Record<string, unknown> | null {
  const start = text.indexOf('{')
  if (start === -1) return null
  const open: string[] = []
  let inString = false
  let end = text.length
  for (let at = start; at < text.length; at++) {
    const char = text[at]
    if (inString) {
      if (char === '\\') at++
      else if (char === '"') inString = false
      continue
    }
    if (char === '"') inString = true
    else if (char === '{' || char === '[') open.push(char === '{' ? '}' : ']')
    else if (char === '}' || char === ']') {
      open.pop()
      if (open.length === 0) {
        end = at + 1
        break
      }
    }
  }
  let body = text.slice(start, end)
  if (open.length > 0) {
    // A dangling escape can't be closed; drop it.
    if (inString) body = `${body.replace(/\\$/, '')}"`
    body = body.trimEnd()
    // A key with no value yet, or a comma before nothing.
    body = body.replace(/,\s*("(?:[^"\\]|\\.)*"\s*)?:?\s*$/, '')
    body = body.replace(/("(?:[^"\\]|\\.)*")\s*:\s*$/, '$1: null')
    body += open.reverse().join('')
  }
  try {
    const value: unknown = JSON.parse(body)
    return isObject(value) ? value : null
  } catch {
    return null
  }
}
