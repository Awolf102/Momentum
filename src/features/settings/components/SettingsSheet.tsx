import type { ReactNode } from 'react'
import { Sheet } from '@/components/Sheet'
import { BackgroundSetting, ThemeSetting } from '@/features/appearance'
import { DataSettings } from './DataSettings'

interface SettingsSheetProps {
  open: boolean
  onClose: () => void
}

export function SettingsSheet({ open, onClose }: SettingsSheetProps) {
  return (
    <Sheet open={open} onClose={onClose} title="Settings">
      <div className="space-y-8 pt-2">
        <Section title="Theme">
          <ThemeSetting />
        </Section>
        <Section
          title="Background"
          description="Choose a scene or add your own photographs. Photos stay on this device."
        >
          <BackgroundSetting />
        </Section>
        <Section
          title="Your data"
          description="Progress is saved in this browser. Export a backup to keep it safe."
        >
          <DataSettings />
        </Section>
      </div>
    </Sheet>
  )
}

function Section({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children: ReactNode
}) {
  return (
    <section>
      <h3 className="text-[11px] font-semibold tracking-[0.18em] text-fg-subtle uppercase">
        {title}
      </h3>
      {description && (
        <p className="mt-1 text-sm text-fg-muted">{description}</p>
      )}
      <div className="mt-3">{children}</div>
    </section>
  )
}
