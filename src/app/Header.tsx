import { Link, useLocation } from 'wouter'
import { AmbienceControl } from '@/features/ambience'
import { FocusPill } from '@/features/focus'
import { formatDateKey } from '@/lib/date'
import { paths } from '@/lib/routes'
import { useToday } from '@/lib/useToday'
import { Logo } from './Logo'

/** The top bar on phones and tablets (wide screens have the sidebar). */
export function Header() {
  const today = useToday()
  const [location] = useLocation()
  return (
    <header className="flex items-center justify-between gap-3 py-4 sm:py-6 lg:hidden">
      <Link
        href={paths.home}
        className="flex items-center gap-2.5 rounded-full glass py-1 pr-4 pl-1"
      >
        <Logo className="size-8" />
        <span className="text-[15px] font-semibold tracking-tight">
          Momentum
        </span>
      </Link>
      <div className="flex items-center gap-2">
        {location !== paths.home && <FocusPill />}
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
        <AmbienceControl />
      </div>
    </header>
  )
}
