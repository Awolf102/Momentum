import { useEffect, useMemo, type ReactNode } from 'react'
import { CommandPalette } from '@/components/CommandPalette'
import { Toaster } from '@/components/Toaster'
import { BackgroundLayer, useUnlockCelebrations } from '@/features/appearance'
import { ClimbOverlay, climbViewStore } from '@/features/climb'
import { SettingsSheet } from '@/features/settings'
import { ShareSheet } from '@/features/share'
import { useReminders } from '@/features/reminder'
import { checkIn, useStreak } from '@/features/streak'
import { cn } from '@/lib/cn'
import { useHotkeys } from '@/lib/hotkeys'
import { ProgressContext } from '@/lib/progress'
import { useStore } from '@/lib/store'
import { useAppCommands } from './commands'
import { Footer } from './Footer'
import { Header } from './Header'
import { closePalette, paletteOpenStore, togglePalette } from './overlays'
import { ShortcutsSheet } from './ShortcutsSheet'

/** The frame every page lives in: background, header, footer and dialogs. */
export function AppShell({ children }: { children: ReactNode }) {
  const { current, longest, lastCheckIn } = useStreak()
  const progress = useMemo(() => ({ current, longest }), [current, longest])
  useReminders({ streak: current, lastCheckIn })
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
  // In the climb view the cards step aside so the mountain can be seen.
  const climbing = useStore(climbViewStore) !== 'off'
  const commands = useAppCommands()
  useUnlockCelebrations()
  useHotkeys([
    { key: 'k', mod: true, global: true, run: togglePalette },
    ...commands
      .filter((command) => command.hotkey)
      .map((command) => ({ ...command.hotkey!, run: command.run })),
  ])

  return (
    <>
      <BackgroundLayer dimmed={!climbing} />
      <ClimbOverlay />
      <div
        inert={climbing}
        className={cn(
          'relative mx-auto flex min-h-dvh w-full max-w-5xl flex-col px-4 pt-[env(safe-area-inset-top)] transition-[opacity,filter] duration-500 sm:px-6',
          climbing && 'opacity-0 blur-sm',
        )}
      >
        <Header />
        <main className="flex flex-1 flex-col">{children}</main>
        <Footer />
      </div>
      <SettingsSheet />
      <ShareSheet />
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
