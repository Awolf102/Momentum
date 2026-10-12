import { cn } from '@/lib/cn'
import type { ReplyPhase } from '../client'
import { useElapsed } from '../hooks/useElapsed'
import { formatElapsed } from '../lib/format'

/**
 * "Thinking… 14 s" while a model works out its reply (small local models
 * can take a minute), then "Writing… 31 s" once it's coming in, so it's
 * clear something is happening.
 */
export function ReplyStatus({
  since,
  phase,
  writing = 'Writing…',
  className,
}: {
  /** When the request was sent (`Date.now()`). */
  since: number
  phase?: ReplyPhase
  /** What to say once the reply is coming in. */
  writing?: string
  className?: string
}) {
  const elapsed = useElapsed(since)
  return (
    <span
      className={cn(
        'inline-flex items-center gap-2 text-sm text-fg-subtle',
        className,
      )}
    >
      <span className="size-2 shrink-0 animate-pulse rounded-full bg-orange-400" />
      <span role="status">{phase === 'writing' ? writing : 'Thinking…'}</span>
      <span className="tabular-nums" aria-hidden>
        {formatElapsed(elapsed)}
      </span>
    </span>
  )
}
