import type { ReactNode } from 'react'
import { BookIcon, HomeIcon, SlidersIcon } from '@/components/icons'
import { paths } from '@/lib/routes'

export interface NavItem {
  href: string
  label: string
  icon: ReactNode
  isActive: (location: string) => boolean
}

/** The app's top-level screens, shown in the sidebar and the tab bar. */
export const NAV_ITEMS: readonly NavItem[] = [
  {
    href: paths.home,
    label: 'Home',
    icon: <HomeIcon />,
    isActive: (location) => location === paths.home,
  },
  {
    href: paths.log,
    label: 'Log',
    icon: <BookIcon />,
    isActive: (location) => location.startsWith(paths.log),
  },
  {
    href: paths.settings(),
    label: 'Settings',
    icon: <SlidersIcon />,
    isActive: (location) => location.startsWith(paths.settings()),
  },
]
