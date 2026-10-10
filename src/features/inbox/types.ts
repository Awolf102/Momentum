import type { CollectionRecord } from '@/lib/collection'

/** Something captured in a hurry, to sort out later. */
export interface InboxItem extends CollectionRecord {
  text: string
  /** A web link that came with it (only http and https). */
  url: string | null
  /** Typed in Momentum, or shared to it from another app. */
  source: 'typed' | 'shared'
}
