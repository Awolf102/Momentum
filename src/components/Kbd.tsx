import { cn } from '@/lib/cn'

/** Renders keys like ⌘ K as small keycaps. */
export function Kbd({
  keys,
  className,
}: {
  keys: string[]
  className?: string
}) {
  return (
    <span className={cn('inline-flex items-center gap-1', className)}>
      {keys.map((key) => (
        <kbd
          key={key}
          className="inline-flex h-5 min-w-5 items-center justify-center rounded-md border border-line bg-tint px-1.5 font-sans text-[11px] font-medium text-fg-muted"
        >
          {key}
        </kbd>
      ))}
    </span>
  )
}
