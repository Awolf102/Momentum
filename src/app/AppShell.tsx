import { motion } from 'motion/react'
import { useEffect, useMemo, type ReactNode } from 'react'
import { useLocation } from 'wouter'
import { CommandPalette } from '@/components/CommandPalette'
import { Toaster } from '@/components/Toaster'
import { BackgroundLayer, useUnlockCelebrations } from '@/features/appearance'
import { ClimbOverlay, climbViewStore } from '@/features/climb'
import { useFocusEngine } from '@/features/focus'
import { ShareSheet } from '@/features/share'
import { HabitSheet } from '@/features/habits'
import { RoutineSheet } from '@/features/routines'
import { QuickAddDialog, TaskSheet } from '@/features/tasks'
import { useReminders } from '@/features/reminder'
import { checkIn, useStreak } from '@/features/streak'
import { cn } from '@/lib/cn'
import { useHotkeys } from '@/lib/hotkeys'
import { closePalette, paletteOpenStore, togglePalette } from '@/lib/overlays'
import { ProgressContext } from '@/lib/progress'
import { useStore } from '@/lib/store'
import { useAppCommands } from './commands'
import { Footer } from './Footer'
import { Header } from './Header'
import { ShortcutsSheet } from './ShortcutsSheet'
import { Sidebar } from './Sidebar'
import { TabBar } from './TabBar'

/**
 * The frame every page lives in: the background, navigation (a sidebar on
 * wide screens, a tab bar on phones), the footer and app-wide dialogs.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const { current, longest, lastCheckIn } = useStreak()
  const progress = useMemo(() => ({ current, longest }), [current, longest])
  useReminders({ streak: current, lastCheckIn })
  // The focus timer runs app-wide, whatever page is open.
  useFocusEngine()
  useLaunchActions()
  return (
    <ProgressContext value={progress}>
      <Chrome>{children}</Chrome>
    </ProgressContext>
  )
}

/**
 * Links that do something on arrival: `/?checkin=1` comes from the reminder
 * notification's "Check in" button and the home-screen shortcut.
 */
function useLaunchActions() {
  useEffect(() => {
    const url = new URL(window.location.href)
    if (url.searchParams.get('checkin') !== '1') return
    url.searchParams.delete('checkin')
    window.history.replaceState(null, '', url)
    // Let the dashboard mount first so the check-in gets its celebration.
    requestAnimationFrame(() => checkIn())
  }, [])
}

function Chrome({ children }: { children: ReactNode }) {
  const paletteOpen = useStore(paletteOpenStore)
  // In the climb view everything steps aside so the mountain can be seen.
  const climbing = useStore(climbViewStore) !== 'off'
  const commands = useAppCommands()
  const [location] = useLocation()
  useUnlockCelebrations()
  useHotkeys([
    { key: 'k', mod: true, global: true, run: togglePalette },
    ...commands
      .filter((command) => command.hotkey)
      .map((command) => ({ ...command.hotkey!, run: command.run })),
  ])

  // A new page starts at the top.
  useEffect(() => window.scrollTo(0, 0), [location])
  // Pages fade in when you move between them (not between settings sections).
  const page = location.split('/')[1] ?? ''

  return (
    <>
      <BackgroundLayer dimmed={!climbing} />
      <ClimbOverlay />
      {/* No filter on this wrapper: it would re-anchor the fixed sidebar and tab bar. */}
      <div inert={climbing}>
        <Sidebar hidden={climbing} />
        <div className="lg:pl-[17.25rem]">
          <div
            className={cn(
              'relative mx-auto flex min-h-dvh w-full max-w-5xl flex-col px-4 pt-[env(safe-area-inset-top)] pb-[calc(env(safe-area-inset-bottom)+5rem)] transition-[opacity,filter] duration-500 sm:px-6 lg:pb-0',
              climbing && 'pointer-events-none opacity-0 blur-sm',
            )}
          >
            <Header />
            <main className="flex flex-1 flex-col lg:pt-8">
              <motion.div
                key={page}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                className="flex flex-1 flex-col"
              >
                {children}
              </motion.div>
            </main>
            <Footer />
          </div>
        </div>
        <TabBar hidden={climbing} />
      </div>
      <ShareSheet />
      <TaskSheet />
      <HabitSheet />
      <RoutineSheet />
      <QuickAddDialog />
      <ShortcutsSheet commands={commands} />
      <CommandPalette
        open={paletteOpen}
        onClose={closePalette}
        commands={commands}
      />
      <Toaster />
    </>
  )
}
