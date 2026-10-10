/** A run of text to split: a whole note, or one page of a document. */
export interface Segment {
  page: number | null
  text: string
}

/** A passage that gets one vector: a few sentences, from one page. */
export interface Chunk {
  page: number | null
  text: string
}

/**
 * How long a passage is, in characters: about 200 tokens, under the 256 the
 * small model on this device reads, and short enough to point at one idea.
 */
export const CHUNK_CHARS = 900
/** A short last sentence starts the next passage too, for context. */
const OVERLAP_CHARS = 200
/** Fewer letters than this (a page number, a caption) isn't worth a vector. */
export const MIN_LETTERS = 24

export function letterCount(text: string): number {
  return text.match(/[\p{L}\p{N}]/gu)?.length ?? 0
}

/** Text as sentences (and lines), punctuation kept. */
export function sentences(text: string): string[] {
  return text
    .split(/\n+/)
    .flatMap((line) => line.split(/(?<=[.!?…]["'”’)\]]*)\s+/))
    .map((sentence) => sentence.trim())
    .filter(Boolean)
}

/** A sentence too long for one passage, cut between words. */
function pieces(sentence: string): string[] {
  if (sentence.length <= CHUNK_CHARS) return [sentence]
  const result: string[] = []
  let current = ''
  for (const word of sentence.split(/\s+/)) {
    if (current && current.length + 1 + word.length > CHUNK_CHARS) {
      result.push(current)
      current = ''
    }
    // A "word" longer than a passage (a URL, an encoded blob) is cut short.
    current = current ? `${current} ${word}` : word.slice(0, CHUNK_CHARS)
  }
  if (current) result.push(current)
  return result
}

/**
 * Splits text into passages of whole sentences, never across pages, each
 * starting with the previous one's last sentence when that's short.
 */
export function chunkSegments(segments: readonly Segment[]): Chunk[] {
  const chunks: Chunk[] = []
  for (const { page, text } of segments) {
    let current: string[] = []
    let length = 0
    const flush = () => {
      const joined = current.join(' ')
      if (letterCount(joined) >= MIN_LETTERS)
        chunks.push({ page, text: joined })
    }
    for (const unit of sentences(text).flatMap(pieces)) {
      if (length > 0 && length + 1 + unit.length > CHUNK_CHARS) {
        flush()
        const last = current[current.length - 1]
        const overlap =
          last.length <= OVERLAP_CHARS &&
          last.length + 1 + unit.length <= CHUNK_CHARS
        current = overlap ? [last] : []
        length = overlap ? last.length : 0
      }
      current.push(unit)
      length += (length > 0 ? 1 : 0) + unit.length
    }
    if (current.length > 0) flush()
  }
  return chunks
}
