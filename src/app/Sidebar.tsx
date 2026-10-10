import { Link, useLocation } from 'wouter'
import { SearchIcon } from '@/components/icons'
import { Kbd } from '@/components/Kbd'
import { AmbienceControl } from '@/features/ambience'
import { FocusPill } from '@/features/focus'
import { cn } from '@/lib/cn'
import { formatDateKey } from '@/lib/date'
import { formatHotkey } from '@/lib/hotkeys'
import { togglePalette } from '@/lib/overlays'
import { paths } from '@/lib/routes'
import { useToday } from '@/lib/useToday'
import { Logo } from './Logo'
import { NAV_ITEMS } from './nav'

/** Navigation on wide screens: a glass panel down the left edge. */
export function Sidebar({ hidden }: { hidden: boolean }) {
  const [location] = useLocation()
  const today = useToday()
  return (
    <aside
      className={cn(
        'fixed inset-y-3 left-3 z-30 hidden w-60 flex-col rounded-[28px] glass p-3 transition-opacity duration-500 lg:flex',
        hidden && 'pointer-events-none opacity-0',
      )}
    >
      <Link
        href={paths.home}
        className="flex items-center gap-2.5 rounded-2xl px-2 py-1.5"
      >
        <Logo className="size-8" />
        <span className="text-[15px] font-semibold tracking-tight">
          Momentum
        </span>
      </Link>
      <button
        type="button"
        onClick={togglePalette}
        className="mt-4 flex items-center gap-2.5 rounded-2xl bg-tint px-3 py-2.5 text-sm text-fg-muted transition hover:bg-line hover:text-fg"
      >
        <SearchIcon className="text-base" />
        Search
        <Kbd className="ml-auto" keys={formatHotkey({ key: 'k', mod: true })} />
      </button>
      <nav aria-label="Main" className="mt-4 flex flex-col gap-1">
        {NAV_ITEMS.map((item) => {
          const active = item.isActive(location)
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-medium transition',
                active
                  ? 'bg-fg/10 text-fg'
                  : 'text-fg-muted hover:bg-tint hover:text-fg',
              )}
            >
              <span className="text-lg">{item.icon}</span>
              {item.label}
            </Link>
          )
        })}
      </nav>
      {location !== paths.home && <FocusPill className="mt-4 self-start" />}
      <div className="mt-auto flex items-center justify-between gap-2 pl-2">
        <time dateTime={today} className="text-xs leading-snug text-fg-subtle">
          {formatDateKey(today, {
            weekday: 'long',
            month: 'long',
            day: 'numeric',
          })}
        </time>
        <AmbienceControl placement="above" />
      </div>
    </aside>
  )
}
