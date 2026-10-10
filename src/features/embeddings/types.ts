import type { Segment } from './lib/chunk'
import type { IndexedSource } from './lib/plan'

export type SourceKind = 'note' | 'document'

/** A note or document as it is now, ready to index. */
export interface Source {
  /** `note:<id>` or `document:<id>`. */
  key: string
  kind: SourceKind
  id: string
  title: string
  segments: Segment[]
  /** Fingerprint of everything that goes into its vectors. */
  hash: string
  /** Characters of text, for estimates. */
  chars: number
}

/** What the index holds about a source (the `embeddingSources` store). */
export interface SourceRecord extends IndexedSource {
  kind: SourceKind
  id: string
  dims: number
  chunks: number
  indexedAt: string
}

/** A source's passages and their vectors (the `embeddingVectors` store). */
export interface VectorRecord {
  key: string
  pages: Array<number | null>
  texts: string[]
  dims: number
  /** One row of `dims` 8-bit values per passage (see `lib/vectors.ts`). */
  values: Int8Array
  scales: Float32Array
}

/** A passage found by meaning. */
export interface MeaningHit {
  key: string
  kind: SourceKind
  id: string
  page: number | null
  text: string
  score: number
}
