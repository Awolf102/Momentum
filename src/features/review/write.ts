import {
  ai,
  formatSource,
  type ReplyPhase,
  type RetryInfo,
} from '@/features/ai'
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
  constructor(cutOff = false) {
    super(
      cutOff
        ? 'The reply was cut off at the length limit before any of the write-up came. Try a longer limit in Settings → AI.'
        : 'Nothing usable came back. Try again in a moment.',
    )
    this.name = 'NoWriteUpError'
  }
}

/** Asks the chat model to write the week up, and keeps what it writes. */
export async function writeUpWeek(
  summary: WeekSummary,
  parts: ReadonlySet<ReviewPart>,
  options: {
    signal?: AbortSignal
    onRetry?: (info: RetryInfo) => void
    onProgress?: (phase: ReplyPhase) => void
  } = {},
): Promise<WrittenReview> {
  const { text, stopReason, source } = await ai.complete({
    system: REVIEW_SYSTEM,
    messages: [{ role: 'user', content: reviewRequest(summary, parts) }],
    maxTokens: WRITE_UP_TOKENS,
    feature: 'summaries',
    signal: options.signal,
    onRetry: options.onRetry,
    onProgress: options.onProgress,
  })
  const cutOff = stopReason === 'max-tokens'
  // A reply cut off at the length limit keeps what it got to.
  const writeUp = readWriteUp(text, { cutOff })
  if (!writeUp) throw new NoWriteUpError(cutOff)
  return saveWriteUp(summary.start, {
    ...writeUp,
    ...(cutOff ? { cutOff } : {}),
    ...(source ? { madeBy: formatSource(source) } : {}),
  })
}
