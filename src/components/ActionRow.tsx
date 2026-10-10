import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

interface ActionRowProps {
  icon: ReactNode
  label: string
  onClick: () => void
  hint?: string
  danger?: boolean
  disabled?: boolean
}

/** A full-width button row, as used in settings lists. */
export function ActionRow({
  icon,
  label,
  onClick,
  hint,
  danger = false,
  disabled,
}: ActionRowProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'flex w-full items-center gap-3 rounded-2xl bg-tint px-4 py-3 text-left text-sm font-medium transition hover:bg-line disabled:opacity-50',
        danger && 'text-rose-300 light:text-rose-600',
      )}
    >
      <span className="text-base opacity-80">{icon}</span>
      {label}
      {hint && (
        <span className="ml-auto text-xs font-normal text-fg-subtle">
          {hint}
        </span>
      )}
    </button>
  )
}
