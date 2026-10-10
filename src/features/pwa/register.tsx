import { registerSW } from 'virtual:pwa-register'
import { CheckIcon, SparkleIcon } from '@/components/icons'
import { toast } from '@/lib/toast'

/** Registers the service worker and tells the user about offline/updates. */
export function registerServiceWorker(): void {
  if (!('serviceWorker' in navigator)) return
  const updateSW = registerSW({
    onNeedRefresh() {
      toast({
        id: 'update',
        icon: <SparkleIcon className="text-amber-300" />,
        title: 'A new version of Momentum is ready',
        action: { label: 'Reload', run: () => void updateSW(true) },
        duration: Infinity,
      })
    },
    onOfflineReady() {
      toast({
        id: 'offline-ready',
        icon: <CheckIcon className="text-orange-300" />,
        title: 'Momentum works offline now',
        description: 'Install it to open it like an app.',
        duration: 6000,
      })
    },
  })
}
