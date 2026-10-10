import { motion } from 'motion/react'
import { useId, type ReactNode } from 'react'
import { cn } from '@/lib/cn'

export interface SegmentedOption<T extends string> {
  value: T
  label: string
  icon?: ReactNode
}

interface SegmentedControlProps<T extends string> {
  label: string
  value: T
  options: readonly SegmentedOption<T>[]
  onChange: (value: T) => void
}

export function SegmentedControl<T extends string>({
  label,
  value,
  options,
  onChange,
}: SegmentedControlProps<T>) {
  const indicatorId = useId()
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="flex rounded-full bg-tint p-1"
    >
      {options.map((option) => {
        const selected = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(option.value)}
            className={cn(
              'relative flex flex-1 items-center justify-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors',
              selected ? 'text-fg' : 'text-fg-subtle hover:text-fg-muted',
            )}
          >
            {selected && (
              <motion.span
                layoutId={indicatorId}
                className="absolute inset-0 rounded-full glass"
                transition={{ type: 'spring', stiffness: 500, damping: 38 }}
              />
            )}
            <span className="relative flex items-center gap-2">
              {option.icon}
              {option.label}
            </span>
          </button>
        )
      })}
    </div>
  )
}
