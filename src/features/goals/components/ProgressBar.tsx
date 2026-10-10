import { cn } from '@/lib/cn'

/**
 * How much of a goal is done, filling from amber to orange. With a target
 * date, a line marks how much of the time has gone: ahead of the line is
 * ahead.
 */
export function ProgressBar({
  share,
  elapsed = null,
  label,
  size = 'md',
  className,
}: {
  share: number
  /** Share of the time to the target gone, if there's a target. */
  elapsed?: number | null
  label: string
  size?: 'sm' | 'md'
  className?: string
}) {
  const value = Math.round(Math.min(1, Math.max(0, share)) * 100)
  return (
    <div className={cn('relative', className)}>
      <div
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={value}
        className={cn(
          'overflow-hidden rounded-full bg-tint',
          size === 'sm' ? 'h-1.5' : 'h-2.5',
        )}
      >
        <div
          className="h-full rounded-full bg-linear-to-r from-amber-300 to-orange-500 transition-[width] duration-500"
          style={{ width: `${value}%` }}
        />
      </div>
      {elapsed !== null && (
        <span
          aria-hidden="true"
          className={cn(
            'absolute w-0.5 -translate-x-1/2 rounded-full bg-fg/70',
            size === 'sm' ? '-inset-y-0.5' : '-inset-y-1',
          )}
          style={{ left: `${Math.min(1, Math.max(0, elapsed)) * 100}%` }}
        />
      )}
    </div>
  )
}
