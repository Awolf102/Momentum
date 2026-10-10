import type { ReactNode } from 'react'
import { GlassCard } from './GlassCard'

interface SettingsCardProps {
  title: string
  description?: ReactNode
  /** Shown at the right of the title row. */
  aside?: ReactNode
  children: ReactNode
}

/** One group of settings on a settings page. */
export function SettingsCard({
  title,
  description,
  aside,
  children,
}: SettingsCardProps) {
  return (
    <GlassCard className="p-5 sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-[11px] font-semibold tracking-[0.18em] text-fg-subtle uppercase">
            {title}
          </h2>
          {description && (
            <p className="mt-1 text-sm text-fg-muted">{description}</p>
          )}
        </div>
        {aside}
      </div>
      <div className="mt-4">{children}</div>
    </GlassCard>
  )
}
