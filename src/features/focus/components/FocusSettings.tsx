import { useState } from 'react'
import { SettingsCard } from '@/components/SettingsCard'
import { Switch } from '@/components/Switch'
import { SubjectsSettings } from '@/features/subjects/settings'
import {
  canNotify,
  notificationsSupported,
  requestNotifications,
} from '@/lib/notify'
import { useStore } from '@/lib/store'
import { syncAmbience } from '../actions'
import { SESSIONS_BEFORE_LONG_BREAK } from '../lib/timer'
import {
  focusSettingsStore,
  LENGTH_LIMITS,
  setAutoAmbience,
  setLength,
  type LengthSetting,
} from '../store'

/** Settings → Focus. */
export function FocusSettings() {
  const settings = useStore(focusSettingsStore)
  return (
    <>
      <SettingsCard
        title="Session lengths"
        description={`A long break comes after every ${SESSIONS_BEFORE_LONG_BREAK} focus sessions. Changes apply from the next session.`}
      >
        <div className="space-y-2">
          <LengthRow
            setting="focusMinutes"
            label="Focus"
            value={settings.focusMinutes}
          />
          <LengthRow
            setting="shortBreakMinutes"
            label="Short break"
            value={settings.shortBreakMinutes}
          />
          <LengthRow
            setting="longBreakMinutes"
            label="Long break"
            value={settings.longBreakMinutes}
          />
        </div>
      </SettingsCard>
      <SettingsCard title="While you focus">
        <div className="space-y-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium">Ambient sound</p>
              <p className="text-xs text-fg-subtle">
                Plays your ambient mix during focus sessions and pauses it for
                breaks.
              </p>
            </div>
            <Switch
              checked={settings.autoAmbience}
              onChange={(on) => {
                setAutoAmbience(on)
                if (on) syncAmbience()
              }}
              label="Ambient sound while focusing"
            />
          </div>
          <NotificationsRow />
        </div>
      </SettingsCard>
      <SettingsCard
        title="Subjects"
        description="Pick one before each session. Sessions keep their subject, so you can see where your time goes."
      >
        <SubjectsSettings />
      </SettingsCard>
    </>
  )
}

function LengthRow({
  setting,
  label,
  value,
}: {
  setting: LengthSetting
  label: string
  value: number
}) {
  const { min, max } = LENGTH_LIMITS[setting]
  const id = `focus-${setting}`
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl bg-tint py-1.5 pr-1.5 pl-4">
      <label htmlFor={id} className="text-sm">
        {label}
      </label>
      <div className="flex items-center gap-1">
        <StepButton
          label={`Shorter ${label.toLowerCase()}`}
          disabled={value <= min}
          onClick={() => setLength(setting, value - 1)}
        >
          −
        </StepButton>
        <input
          id={id}
          type="number"
          inputMode="numeric"
          min={min}
          max={max}
          value={value}
          onChange={(event) => {
            const next = Number(event.target.value)
            if (Number.isFinite(next) && event.target.value !== '')
              setLength(setting, next)
          }}
          className="w-12 [appearance:textfield] bg-transparent text-center font-semibold tabular-nums outline-none focus-visible:outline-none [&::-webkit-inner-spin-button]:appearance-none"
        />
        <span className="w-7 text-xs text-fg-subtle">min</span>
        <StepButton
          label={`Longer ${label.toLowerCase()}`}
          disabled={value >= max}
          onClick={() => setLength(setting, value + 1)}
        >
          +
        </StepButton>
      </div>
    </div>
  )
}

function StepButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string
  disabled: boolean
  onClick: () => void
  children: string
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="grid size-8 place-items-center rounded-full text-lg leading-none transition hover:bg-line disabled:opacity-30"
    >
      {children}
    </button>
  )
}

function NotificationsRow() {
  const [allowed, setAllowed] = useState(canNotify)
  const [problem, setProblem] = useState<string | null>(null)
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">When a session ends</p>
      <p className="text-xs leading-relaxed text-fg-subtle">
        A soft chime plays.{' '}
        {allowed
          ? "If you're in another tab, you also get a notification."
          : 'Allow notifications to hear about it from another tab or app too.'}
      </p>
      {!allowed && notificationsSupported() && (
        <button
          type="button"
          onClick={async () => {
            const reason = await requestNotifications()
            setProblem(reason)
            setAllowed(reason === null)
          }}
          className="rounded-full bg-tint px-4 py-2 text-xs font-semibold transition hover:bg-line"
        >
          Allow notifications
        </button>
      )}
      {problem && (
        <p className="text-xs text-rose-300 light:text-rose-600">{problem}</p>
      )}
    </div>
  )
}
