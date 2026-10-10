import '@fontsource-variable/inter'
import '@fontsource/instrument-serif/400.css'
import '@fontsource/instrument-serif/400-italic.css'
import './styles/index.css'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './app/App'
import { StorageBlocked } from './app/StorageBlocked'
import { listenForInstallPrompt, registerServiceWorker } from './features/pwa'
import { onDbEvent } from './lib/db/db'
import { loadSecretNames } from './lib/secrets'
import { hydrateStores, requestPersistentStorage } from './lib/storage'
import { toast } from './lib/toast'

listenForInstallPrompt()
registerServiceWorker()

const root = createRoot(document.getElementById('root')!)
let started = false

onDbEvent((event) => {
  // An older tab is holding up a storage upgrade: explain the wait.
  if (event === 'blocked' && !started) root.render(<StorageBlocked />)
  // A newer version upgraded storage in another tab: this one must reload.
  if (event === 'outdated') {
    toast({
      id: 'storage-outdated',
      title: 'Momentum was updated in another tab',
      description: 'Reload to keep saving your changes.',
      action: { label: 'Reload', run: () => window.location.reload() },
      duration: Infinity,
    })
  }
})

// Load every store from IndexedDB (migrating older localStorage data) before
// the first render, so nothing flashes from defaults to saved values.
void Promise.all([hydrateStores(), loadSecretNames()]).finally(() => {
  started = true
  root.render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
  void requestPersistentStorage()
})
