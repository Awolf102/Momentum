import { useCallback, useState, type ReactNode } from 'react'
import { BackgroundLayer } from '@/features/appearance'
import { SettingsSheet } from '@/features/settings'
import { Footer } from './Footer'
import { Header } from './Header'

/** The frame every page lives in: background, header, footer and settings. */
export function AppShell({ children }: { children: ReactNode }) {
  const [settingsOpen, setSettingsOpen] = useState(false)
  const openSettings = useCallback(() => setSettingsOpen(true), [])
  const closeSettings = useCallback(() => setSettingsOpen(false), [])

  return (
    <>
      <BackgroundLayer />
      <div className="relative mx-auto flex min-h-dvh w-full max-w-5xl flex-col px-4 pt-[env(safe-area-inset-top)] sm:px-6">
        <Header onOpenSettings={openSettings} />
        <main className="flex flex-1 flex-col">{children}</main>
        <Footer />
      </div>
      <SettingsSheet open={settingsOpen} onClose={closeSettings} />
    </>
  )
}
