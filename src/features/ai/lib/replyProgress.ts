import type { ReplyPhase } from '../client'

/** How far a reply has got, since it was asked for. */
export interface ReplyProgress {
  /** When the request was sent (`Date.now()`). */
  since: number
  phase?: ReplyPhase
}

/** A reply's progress as it's asked for. */
export const startReply = (): ReplyProgress => ({ since: Date.now() })
