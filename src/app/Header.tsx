import { IconButton } from '@/components/IconButton'
import { SearchIcon, SlidersIcon } from '@/components/icons'
import { Kbd } from '@/components/Kbd'
import { AmbienceControl } from '@/features/ambience'
import { openSettings } from '@/features/settings'
import { formatDateKey } from '@/lib/date'
import { formatHotkey } from '@/lib/hotkeys'
import { useToday } from '@/lib/useToday'
import { Logo } from './Logo'
import { togglePalette } from './overlays'

export function Header() {
  const today = useToday()
  return (
    <header className="flex items-center justify-between gap-3 py-4 sm:py-6">
      <div className="flex items-center gap-2.5 rounded-full glass py-1 pr-4 pl-1">
        <Logo className="size-8" />
        <span className="text-[15px] font-semibold tracking-tight">
          Momentum
        </span>
      </div>
      <div className="flex items-center gap-2">
        <time
          dateTime={today}
          className="hidden rounded-full glass px-4 py-2 text-sm font-medium text-fg-muted md:inline-block"
        >
          {formatDateKey(today, {
            weekday: 'long',
            month: 'long',
            day: 'numeric',
          })}
        </time>
        <button
          type="button"
          onClick={togglePalette}
          aria-label="Open command palette"
          className="hidden h-10 items-center gap-2 rounded-full glass pr-2.5 pl-3.5 text-sm text-fg-muted transition hover:text-fg sm:inline-flex"
        >
          <SearchIcon className="text-base" />
          <Kbd keys={formatHotkey({ key: 'k', mod: true })} />
        </button>
        <AmbienceControl />
        <IconButton label="Settings" onClick={openSettings}>
          <SlidersIcon />
        </IconButton>
      </div>
    </header>
  )
}
