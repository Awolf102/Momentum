import type { ReactNode } from 'react'
import { MoonIcon, SunIcon } from '@/components/icons'
import { SegmentedControl } from '@/components/SegmentedControl'
import { useStore } from '@/lib/persistentStore'
import { appearanceStore, MAX_OVERLAY, setOverlay, setTheme } from '../store'
import type { ThemeMode } from '../types'
import { BackgroundPicker } from './BackgroundPicker'

const THEME_OPTIONS = [
  { value: 'dark', label: 'Dark', icon: <MoonIcon /> },
  { value: 'light', label: 'Light', icon: <SunIcon /> },
] as const satisfies readonly {
  value: ThemeMode
  label: string
  icon: ReactNode
}[]

export function ThemeSetting() {
  const { theme } = useStore(appearanceStore)
  return (
    <SegmentedControl
      label="Theme"
      value={theme}
      options={THEME_OPTIONS}
      onChange={setTheme}
    />
  )
}

export function BackgroundSetting() {
  const { overlay } = useStore(appearanceStore)
  return (
    <div className="space-y-5">
      <BackgroundPicker />
      <label className="block">
        <span className="flex items-center justify-between text-sm">
          <span className="font-medium">Overlay</span>
          <span className="text-fg-subtle tabular-nums">
            {Math.round((overlay / MAX_OVERLAY) * 100)}%
          </span>
        </span>
        <span className="mt-0.5 block text-xs text-fg-subtle">
          Dims the background so cards stay easy to read.
        </span>
        <input
          type="range"
          min={0}
          max={MAX_OVERLAY}
          step={0.02}
          value={overlay}
          onChange={(event) => setOverlay(Number(event.target.value))}
          className="mt-3 w-full"
        />
      </label>
    </div>
  )
}
