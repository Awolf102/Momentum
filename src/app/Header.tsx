import { IconButton } from '@/components/IconButton'
import { SlidersIcon } from '@/components/icons'
import { formatDateKey } from '@/lib/date'
import { useToday } from '@/lib/useToday'
import { Logo } from './Logo'

export function Header({ onOpenSettings }: { onOpenSettings: () => void }) {
  const today = useToday()
  return (
    <header className="flex items-center justify-between gap-4 py-4 sm:py-6">
      <div className="flex items-center gap-2.5 rounded-full glass py-1 pr-4 pl-1">
        <Logo className="size-8" />
        <span className="text-[15px] font-semibold tracking-tight">
          Momentum
        </span>
      </div>
      <div className="flex items-center gap-2">
        <time
          dateTime={today}
          className="hidden rounded-full glass px-4 py-2 text-sm font-medium text-fg-muted sm:inline-block"
        >
          {formatDateKey(today, {
            weekday: 'long',
            month: 'long',
            day: 'numeric',
          })}
        </time>
        <IconButton label="Settings" onClick={onOpenSettings}>
          <SlidersIcon />
        </IconButton>
      </div>
    </header>
  )
}
