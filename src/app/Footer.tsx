import { appearanceStore, resolveBackground } from '@/features/appearance'
import { useStore } from '@/lib/persistentStore'

export function Footer() {
  const { backgroundId, photos } = useStore(appearanceStore)
  const background = resolveBackground(backgroundId, photos)
  return (
    <footer className="flex flex-wrap items-center justify-between gap-x-6 gap-y-1 py-6 text-xs text-fg-subtle text-shadow-soft">
      <p>Your progress is saved on this device.</p>
      <p>Background · {background.name}</p>
    </footer>
  )
}
