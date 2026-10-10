import { createStore } from '@/lib/store'

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export interface InstallState {
  /** The browser offered an install prompt we can show (Chromium). */
  canPrompt: boolean
  installed: boolean
}

function isStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}

export const isIos = () => /iPhone|iPad|iPod/.test(navigator.userAgent)

export const installStore = createStore<InstallState>({
  canPrompt: false,
  installed: typeof window !== 'undefined' && isStandalone(),
})

let deferredPrompt: BeforeInstallPromptEvent | null = null

/** Must run before the app renders: the browser fires `beforeinstallprompt` early. */
export function listenForInstallPrompt(): void {
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault()
    deferredPrompt = event as BeforeInstallPromptEvent
    installStore.set((state) => ({ ...state, canPrompt: true }))
  })
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null
    installStore.set({ canPrompt: false, installed: true })
  })
}

export async function promptInstall(): Promise<boolean> {
  if (!deferredPrompt) return false
  await deferredPrompt.prompt()
  const { outcome } = await deferredPrompt.userChoice
  deferredPrompt = null
  installStore.set((state) => ({ ...state, canPrompt: false }))
  return outcome === 'accepted'
}
