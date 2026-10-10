import { Switch } from '@/components/Switch'
import { useStore } from '@/lib/store'
import { reviewStore, setReviewOnSundays } from '../store'

/** Settings → App: whether the dashboard shows your week on Sundays. */
export function WeekReviewSetting() {
  const { onSundays } = useStore(reviewStore)
  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <p className="text-sm font-medium">Your week, on Sundays</p>
        <p className="text-xs text-fg-subtle">
          The dashboard shows the week’s focus, habits and tasks on Sundays, and
          last week’s on Mondays. Nothing is sent anywhere unless you ask AI to
          write it up.
        </p>
      </div>
      <Switch
        checked={onSundays}
        onChange={setReviewOnSundays}
        label="Your week, on Sundays"
      />
    </div>
  )
}
