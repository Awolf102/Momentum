import type { CollectionRecord } from '@/lib/collection'

/** A PDF in the library. The file itself is stored separately. */
export interface LibraryDocument extends CollectionRecord {
  title: string
  fileName: string
  /** In bytes. */
  size: number
  /** Known once the file has been read. */
  pages: number | null
  subjectId: string | null
  /** Where you were, from 1. */
  lastPage: number
  lastOpenedAt: string | null
}

export const HIGHLIGHT_COLORS = ['yellow', 'green', 'blue', 'pink'] as const
export type HighlightColor = (typeof HIGHLIGHT_COLORS)[number]

/** A rectangle on a page, in fractions of the page's width and height. */
export interface PageRect {
  x: number
  y: number
  w: number
  h: number
}

/** Highlighted text on a page, with an optional note in the margin. */
export interface Highlight extends CollectionRecord {
  documentId: string
  /** From 1. */
  page: number
  rects: PageRect[]
  /** The words highlighted. */
  quote: string
  color: HighlightColor
  note: string
}
