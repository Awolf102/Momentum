import type { ComponentType, ReactNode } from 'react'
import {
  BookIcon,
  CardsIcon,
  ChartIcon,
  ChatIcon,
  ChecklistIcon,
  GoalIcon,
  HomeIcon,
  InboxIcon,
  LibraryIcon,
  NoteIcon,
  PlanIcon,
  QuizIcon,
  SlidersIcon,
} from '@/components/icons'
import { InboxBadge } from '@/features/inbox'
import { paths } from '@/lib/routes'

export interface NavItem {
  href: string
  label: string
  icon: ReactNode
  isActive: (location: string) => boolean
  /** Left out of the phone tab bar (which has room for five). */
  tabBar?: false
  /** A count beside the name in the sidebar. */
  badge?: ComponentType
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
    href: paths.tasks,
    label: 'Tasks',
    icon: <ChecklistIcon />,
    isActive: (location) => location.startsWith(paths.tasks),
  },
  {
    href: paths.plan,
    label: 'Plan',
    icon: <PlanIcon />,
    isActive: (location) => location.startsWith(paths.plan),
    tabBar: false,
  },
  {
    href: paths.goals,
    label: 'Goals',
    icon: <GoalIcon />,
    isActive: (location) => location.startsWith(paths.goals),
    tabBar: false,
  },
  {
    href: paths.notes,
    label: 'Notes',
    icon: <NoteIcon />,
    // Notes from photos and speech are made here too.
    isActive: (location) =>
      [paths.notes, paths.photoNote, paths.voiceNote].some((path) =>
        location.startsWith(path),
      ),
  },
  {
    href: paths.library,
    label: 'Library',
    icon: <LibraryIcon />,
    isActive: (location) => location.startsWith(paths.library),
    tabBar: false,
  },
  {
    href: paths.cards,
    label: 'Cards',
    icon: <CardsIcon />,
    isActive: (location) => location.startsWith(paths.cards),
    tabBar: false,
  },
  {
    href: paths.quizzes,
    label: 'Quizzes',
    icon: <QuizIcon />,
    isActive: (location) => location.startsWith(paths.quizzes),
    tabBar: false,
  },
  {
    href: paths.assistant,
    label: 'Ask',
    icon: <ChatIcon />,
    isActive: (location) => location.startsWith(paths.assistant),
    tabBar: false,
  },
  {
    href: paths.inbox,
    label: 'Inbox',
    icon: <InboxIcon />,
    isActive: (location) => location.startsWith(paths.inbox),
    tabBar: false,
    badge: InboxBadge,
  },
  {
    href: paths.log,
    label: 'Log',
    icon: <BookIcon />,
    isActive: (location) => location.startsWith(paths.log),
    tabBar: false,
  },
  {
    href: paths.analytics(),
    label: 'Analytics',
    icon: <ChartIcon />,
    isActive: (location) => location.startsWith(paths.analytics()),
    tabBar: false,
  },
  {
    href: paths.settings(),
    label: 'Settings',
    icon: <SlidersIcon />,
    isActive: (location) => location.startsWith(paths.settings()),
  },
]
