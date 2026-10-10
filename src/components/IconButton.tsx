import type { ComponentPropsWithoutRef } from 'react'
import { cn } from '@/lib/cn'

interface IconButtonProps extends ComponentPropsWithoutRef<'button'> {
  /** Accessible name — icon buttons have no visible text. */
  label: string
}

export function IconButton({
  label,
  className,
  children,
  ...props
}: IconButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cn(
        'inline-flex size-10 items-center justify-center rounded-full glass text-lg text-fg transition',
        'hover:scale-105 active:scale-95',
        className,
      )}
      {...props}
    >
      {children}
    </button>
  )
}
