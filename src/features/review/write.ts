import { ai, type RetryInfo } from '@/features/ai'
import type { WeekSummary } from './lib/week'
import {
  readWriteUp,
  REVIEW_SYSTEM,
  reviewRequest,
  type ReviewPart,
} from './lib/writeUp'
import { saveWriteUp, type WrittenReview } from './store'

/** Room for the reply: three short paragraphs. */
const WRITE_UP_TOKENS = 700

/** The reply had no write-up in it. */
export class NoWriteUpError extends Error {
  constructor() {
    super('Nothing usable came back. Try again in a moment.')
    this.name = 'NoWriteUpError'
  }
}

/** Asks the chat model to write the week up, and keeps what it writes. */
export async function writeUpWeek(
  summary: WeekSummary,
  parts: ReadonlySet<ReviewPart>,
  options: { signal?: AbortSignal; onRetry?: (info: RetryInfo) => void } = {},
): Promise<WrittenReview> {
  const { text } = await ai.complete({
    system: REVIEW_SYSTEM,
    messages: [{ role: 'user', content: reviewRequest(summary, parts) }],
    maxTokens: WRITE_UP_TOKENS,
    signal: options.signal,
    onRetry: options.onRetry,
  })
  const writeUp = readWriteUp(text)
  if (!writeUp) throw new NoWriteUpError()
  return saveWriteUp(summary.start, writeUp)
}
