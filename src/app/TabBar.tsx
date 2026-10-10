import type { ReactNode } from 'react'
import { Link, useLocation } from 'wouter'
import { SearchIcon } from '@/components/icons'
import { cn } from '@/lib/cn'
import { togglePalette } from '@/lib/overlays'
import { NAV_ITEMS, type NavItem } from './nav'

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
  // Pages, then search, with settings at the end:
  // Home · Tasks · Notes · Search · Settings.
  const pages = NAV_ITEMS.slice(0, -1).filter((item) => item.tabBar !== false)
  const settings = NAV_ITEMS.at(-1)!
  const link = (item: NavItem) => (
    <Link
      key={item.href}
      href={item.href}
      aria-current={item.isActive(location) ? 'page' : undefined}
      className={tabClass(item.isActive(location))}
    >
      <TabContent icon={item.icon} label={item.label} />
    </Link>
  )
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
        {pages.map(link)}
        <button
          type="button"
          onClick={togglePalette}
          className={tabClass(false)}
        >
          <TabContent icon={<SearchIcon />} label="Search" />
        </button>
        {link(settings)}
      </div>
    </nav>
  )
}
