import { motion } from 'motion/react'
import type { ReactNode } from 'react'
import { Link, Redirect, useParams } from 'wouter'
import { ActionRow } from '@/components/ActionRow'
import {
  AppIcon,
  DatabaseIcon,
  KeyboardIcon,
  PaletteIcon,
  SparkleIcon,
  TimerIcon,
} from '@/components/icons'
import { SettingsCard } from '@/components/SettingsCard'
import { AiSettingsPanel } from '@/features/ai'
import {
  BackgroundSetting,
  LightSetting,
  ThemeSetting,
} from '@/features/appearance'
import { DataSettings } from '@/features/backup'
import { MeaningIndexCard } from '@/features/embeddings'
import { FocusSettings } from '@/features/focus/settings'
import { InstallSetting } from '@/features/pwa'
import { ReminderSetting } from '@/features/reminder'
import { WeekReviewSetting } from '@/features/review/settings'
import { cn } from '@/lib/cn'
import { formatHotkey } from '@/lib/hotkeys'
import { openShortcuts } from '@/lib/overlays'
import {
  isSettingsSection,
  paths,
  SETTINGS_SECTIONS,
  type SettingsSection,
} from '@/lib/routes'

const SECTIONS: Record<SettingsSection, { label: string; icon: ReactNode }> = {
  appearance: { label: 'Appearance', icon: <PaletteIcon /> },
  focus: { label: 'Focus', icon: <TimerIcon /> },
  app: { label: 'App', icon: <AppIcon /> },
  ai: { label: 'AI', icon: <SparkleIcon /> },
  data: { label: 'Data', icon: <DatabaseIcon /> },
}

export default function SettingsPage() {
  const { section = 'appearance' } = useParams<{ section?: string }>()
  if (!isSettingsSection(section))
    return <Redirect to={paths.settings()} replace />

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col pt-2 pb-8 sm:pt-6 lg:pt-2">
      <h1 className="font-serif text-5xl leading-none tracking-tight text-shadow-soft sm:text-6xl">
        Settings
      </h1>
      <SectionNav current={section} />
      <motion.div
        key={section}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
        className="mt-5 flex flex-col gap-4"
      >
        <SectionContent section={section} />
      </motion.div>
    </div>
  )
}

function SectionNav({ current }: { current: SettingsSection }) {
  return (
    <nav
      aria-label="Settings sections"
      className="mt-6 flex rounded-full glass p-1"
    >
      {SETTINGS_SECTIONS.map((id) => {
        const active = id === current
        return (
          <Link
            key={id}
            href={paths.settings(id)}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'relative flex flex-auto items-center justify-center gap-2 rounded-full px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors sm:flex-1 sm:px-4',
              active ? 'text-fg' : 'text-fg-subtle hover:text-fg-muted',
            )}
          >
            {active && (
              <motion.span
                layoutId="settings-section"
                className="absolute inset-0 rounded-full bg-fg/10"
                transition={{ type: 'spring', stiffness: 500, damping: 38 }}
              />
            )}
            <span className="relative hidden sm:inline">
              {SECTIONS[id].icon}
            </span>
            <span className="relative">{SECTIONS[id].label}</span>
          </Link>
        )
      })}
    </nav>
  )
}

function SectionContent({ section }: { section: SettingsSection }) {
  switch (section) {
    case 'appearance':
      return (
        <>
          <SettingsCard title="Theme">
            <ThemeSetting />
          </SettingsCard>
          <SettingsCard
            title="Background"
            description="Choose a scene or add your own photographs. Photos stay on this device."
          >
            <BackgroundSetting />
          </SettingsCard>
          <SettingsCard title="Light">
            <LightSetting />
          </SettingsCard>
        </>
      )
    case 'focus':
      return <FocusSettings />
    case 'app':
      return (
        <>
          <SettingsCard title="Reminder">
            <ReminderSetting />
          </SettingsCard>
          <SettingsCard title="Weekly review">
            <WeekReviewSetting />
          </SettingsCard>
          <SettingsCard title="Install">
            <InstallSetting />
          </SettingsCard>
          <SettingsCard
            title="Keyboard"
            description={`Press ${formatHotkey({ key: 'k', mod: true }).join(' ')} anywhere to search and run commands.`}
          >
            <ActionRow
              icon={<KeyboardIcon />}
              label="Keyboard shortcuts"
              hint="?"
              onClick={openShortcuts}
            />
          </SettingsCard>
        </>
      )
    case 'ai':
      return <AiSettingsPanel afterEmbeddings={<MeaningIndexCard />} />
    case 'data':
      return <DataSettings />
  }
}
