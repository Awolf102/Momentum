import type { ReactNode } from 'react'
import { MoonIcon, SunIcon } from '@/components/icons'
import { SegmentedControl } from '@/components/SegmentedControl'
import { useProgress } from '@/lib/progress'
import { useStore } from '@/lib/store'
import { useLight } from '../hooks/useBackground'
import { FULL_WARMTH_DAYS, PHASE_LABELS, type LightMode } from '../lib/light'
import {
  appearanceStore,
  MAX_OVERLAY,
  setLight,
  setOverlay,
  setTheme,
} from '../store'
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

const LIGHT_OPTIONS = [
  { value: 'time', label: 'Time of day' },
  { value: 'streak', label: 'Streak' },
  { value: 'off', label: 'Off' },
] as const satisfies readonly { value: LightMode; label: string }[]

export function LightSetting() {
  const { light: mode } = useStore(appearanceStore)
  const light = useLight()
  const { current } = useProgress()
  const phase = PHASE_LABELS[light.phase].toLowerCase()
  const description = {
    time: `Shifts from dawn to dusk with the clock. Right now: ${phase}.`,
    streak: `Warms from night to golden hour as your streak grows (full warmth at ${FULL_WARMTH_DAYS} days). At ${current} ${current === 1 ? 'day' : 'days'}: ${phase}.`,
    off: 'The mountain stays at dusk and photos are shown as taken.',
  }[mode]
  return (
    <div className="space-y-3">
      <SegmentedControl
        label="Light"
        value={mode}
        options={LIGHT_OPTIONS}
        onChange={setLight}
      />
      <p className="text-xs text-fg-subtle">{description}</p>
    </div>
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
