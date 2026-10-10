import type { CollectionRecord } from '@/lib/collection'
import type { DateKey } from '@/lib/date'

/**
 * One line about a day: what you did, how it went. Its id is the day, so
 * there is never more than one per day, on any device.
 */
export interface LogEntry extends CollectionRecord {
  day: DateKey
  text: string
}
