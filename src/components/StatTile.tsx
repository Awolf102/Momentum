import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'
import { GlassCard } from './GlassCard'

interface StatTileProps {
  icon: ReactNode
  label: string
  value: number
  /** Shown after the number, e.g. "days" or "min". */
  unit: string
  hint: string
  highlight?: boolean
  className?: string
}

/** A small glass tile with one big serif number, as on the dashboard. */
export function StatTile({
  icon,
  label,
  value,
  unit,
  hint,
  highlight = false,
  className,
}: StatTileProps) {
  return (
    <GlassCard className={cn('px-5 py-4 sm:px-6 sm:py-5', className)}>
      <p className="flex items-center gap-2 text-[11px] font-semibold tracking-[0.12em] whitespace-nowrap text-fg-subtle uppercase sm:tracking-[0.18em]">
        <span
          className={cn(
            'hidden text-sm sm:inline',
            highlight ? 'text-orange-300 light:text-orange-500' : '',
          )}
        >
          {icon}
        </span>
        {label}
      </p>
      <p className="mt-2 flex items-baseline gap-1.5">
        <span className="font-serif text-5xl leading-none tabular-nums">
          {value}
        </span>
        <span className="text-sm text-fg-muted">{unit}</span>
      </p>
      <p
        className={cn(
          'mt-2 truncate text-xs',
          highlight
            ? 'text-orange-200 light:text-orange-600'
            : 'text-fg-subtle',
        )}
      >
        {hint}
      </p>
    </GlassCard>
  )
}
