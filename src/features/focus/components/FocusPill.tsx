import { Link } from 'wouter'
import { cn } from '@/lib/cn'
import { paths } from '@/lib/routes'
import { useStore } from '@/lib/store'
import { useNow } from '../hooks/useNow'
import { formatCountdown } from '../lib/format'
import { remainingMs } from '../lib/timer'
import { focusTimerStore } from '../store'

/** The running timer, small, for pages other than Home. */
export function FocusPill({ className }: { className?: string }) {
  const { phase } = useStore(focusTimerStore)
  const now = useNow(phase !== null && phase.pausedAt === null)
  if (!phase) return null
  const paused = phase.pausedAt !== null
  const label = paused ? 'Paused' : phase.kind === 'focus' ? 'Focus' : 'Break'
  const time = formatCountdown(remainingMs(phase, now))
  return (
    <Link
      href={paths.home}
      aria-label={`${label}, ${time} left. Open the timer.`}
      className={cn(
        'inline-flex items-center gap-2 rounded-full glass px-3.5 py-2 text-sm font-medium tabular-nums transition hover:scale-[1.02]',
        className,
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          'size-2 rounded-full',
          phase.kind === 'focus' ? 'bg-orange-400' : 'bg-teal-300',
          paused ? 'opacity-50' : 'motion-safe:animate-pulse',
        )}
      />
      {time}
      <span className="text-fg-subtle">{label}</span>
    </Link>
  )
}
