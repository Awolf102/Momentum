import {
  appearanceStore,
  PHASE_LABELS,
  SCENES,
  useCurrentBackground,
  useLight,
} from '@/features/appearance'
import { useStore } from '@/lib/store'

export function Footer() {
  const background = useCurrentBackground()
  const light = useLight()
  const { light: mode } = useStore(appearanceStore)
  // Light only changes photos and the main scene (reward scenes keep their mood).
  const lit =
    mode !== 'off' &&
    (background.kind === 'photo' ||
      background.kind === 'user-photo' ||
      (background.kind === 'scene' && !SCENES[background.scene].palette))
  return (
    <footer className="flex flex-wrap items-center justify-between gap-x-6 gap-y-1 py-6 text-xs text-fg-subtle text-shadow-soft">
      <p>Your progress is saved on this device.</p>
      <p>
        {background.name}
        {lit && ` · ${PHASE_LABELS[light.phase]}`}
      </p>
    </footer>
  )
}
