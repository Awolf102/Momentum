import { useState } from 'react'
import { cn } from '@/lib/cn'
import { useStore } from '@/lib/store'
import {
  disableReminder,
  enableReminder,
  reminderStore,
  setReminderTime,
} from '../store'

export function ReminderSetting() {
  const { enabled, time } = useStore(reminderStore)
  const [problem, setProblem] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function toggle() {
    if (enabled) {
      disableReminder()
      return
    }
    setBusy(true)
    setProblem(await enableReminder())
    setBusy(false)
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium">Evening reminder</p>
          <p className="text-xs text-fg-subtle">
            Only if you haven't checked in yet.
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          aria-label="Evening reminder"
          disabled={busy}
          onClick={() => void toggle()}
          className={cn(
            'relative h-7 w-12 shrink-0 rounded-full transition-colors',
            enabled ? 'bg-orange-400' : 'bg-line',
          )}
        >
          <span
            className={cn(
              'absolute top-1 left-1 size-5 rounded-full bg-white shadow transition-transform',
              enabled && 'translate-x-5',
            )}
          />
        </button>
      </div>
      {enabled && (
        <label className="flex items-center justify-between rounded-2xl bg-tint px-4 py-2.5 text-sm">
          <span>Remind me at</span>
          <input
            type="time"
            value={time}
            onChange={(event) =>
              event.target.value && setReminderTime(event.target.value)
            }
            className="bg-transparent text-right font-medium text-fg tabular-nums outline-none"
          />
        </label>
      )}
      {problem && (
        <p role="alert" className="text-xs text-rose-300 light:text-rose-600">
          {problem}
        </p>
      )}
      {enabled && (
        <p className="text-xs leading-relaxed text-fg-subtle">
          Reminders arrive while Momentum is open, even in a background tab.
          Installed on Android or desktop Chrome, it can also nudge you when
          it's closed.
        </p>
      )}
    </div>
  )
}
