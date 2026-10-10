import type { ReactNode } from 'react'
import { Link, useLocation } from 'wouter'
import { SearchIcon } from '@/components/icons'
import { cn } from '@/lib/cn'
import { togglePalette } from '@/lib/overlays'
import { NAV_ITEMS } from './nav'

const tabClass = (active: boolean) =>
  cn(
    'flex flex-1 flex-col items-center gap-0.5 rounded-full py-1.5 text-[11px] font-medium transition',
    active ? 'bg-fg/10 text-fg' : 'text-fg-subtle hover:text-fg-muted',
  )

function TabContent({ icon, label }: { icon: ReactNode; label: string }) {
  return (
    <>
      <span className="text-xl">{icon}</span>
      {label}
    </>
  )
}

/** Navigation on phones and tablets: a floating bar within thumb reach. */
export function TabBar({ hidden }: { hidden: boolean }) {
  const [location] = useLocation()
  const [home, settings] = NAV_ITEMS
  return (
    <nav
      aria-label="Main"
      className={cn(
        'pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] transition-opacity duration-500 lg:hidden',
        hidden && 'opacity-0',
      )}
    >
      <div
        className={cn(
          'flex w-full max-w-sm items-center gap-1 rounded-full glass-strong p-1.5',
          !hidden && 'pointer-events-auto',
        )}
      >
        <Link
          href={home.href}
          aria-current={home.isActive(location) ? 'page' : undefined}
          className={tabClass(home.isActive(location))}
        >
          <TabContent icon={home.icon} label={home.label} />
        </Link>
        <button
          type="button"
          onClick={togglePalette}
          className={tabClass(false)}
        >
          <TabContent icon={<SearchIcon />} label="Search" />
        </button>
        <Link
          href={settings.href}
          aria-current={settings.isActive(location) ? 'page' : undefined}
          className={tabClass(settings.isActive(location))}
        >
          <TabContent icon={settings.icon} label={settings.label} />
        </Link>
      </div>
    </nav>
  )
}
