import type { CollectionRecord } from '@/lib/collection'

/** A note, written in markdown. */
export interface Note extends CollectionRecord {
  /** May be empty ("Untitled"). Other notes link to it by this. */
  title: string
  body: string
  subjectId: string | null
  pinned: boolean
}
