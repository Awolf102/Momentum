/** What the index holds for one note or document. */
export interface IndexedSource {
  key: string
  /** Of the text it was made from (see `hashText`). */
  hash: string
  /** The model its vectors came from: "provider:model". */
  space: string
}

/** Something that can be indexed, as it is now. */
export interface Indexable {
  key: string
  hash: string
}

export interface IndexPlan<S extends Indexable> {
  /** New, changed, or indexed with another model: to embed. */
  embed: S[]
  /** Gone, or kept out of the index: to delete. */
  remove: string[]
  /** Already indexed as they are now, with this model. */
  current: S[]
}

/** What to do to bring the index up to date with `sources`. */
export function planIndex<S extends Indexable>(
  sources: readonly S[],
  indexed: readonly IndexedSource[],
  space: string,
  excluded: ReadonlySet<string> = new Set(),
): IndexPlan<S> {
  const byKey = new Map(indexed.map((record) => [record.key, record]))
  const wanted = new Set<string>()
  const plan: IndexPlan<S> = { embed: [], remove: [], current: [] }
  for (const source of sources) {
    if (excluded.has(source.key)) continue
    wanted.add(source.key)
    const record = byKey.get(source.key)
    if (record && record.hash === source.hash && record.space === space)
      plan.current.push(source)
    else plan.embed.push(source)
  }
  for (const record of indexed)
    if (!wanted.has(record.key)) plan.remove.push(record.key)
  return plan
}

/** A short fingerprint of some text (cyrb53: fast, not cryptographic). */
export function hashText(text: string): string {
  let h1 = 0xdeadbeef
  let h2 = 0x41c6ce57
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i)
    h1 = Math.imul(h1 ^ code, 2654435761)
    h2 = Math.imul(h2 ^ code, 1597334677)
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507)
  h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909)
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507)
  h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909)
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36)
}

/** Roughly how many tokens a text is, for estimates (about 4 characters each). */
export function estimateTokens(characters: number): number {
  return Math.ceil(characters / 4)
}
