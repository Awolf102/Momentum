import { getSecret } from '@/lib/secrets'
import { createAiClient } from './client'
import { currentPage } from './lib/reach'
import { createProvider } from './providers'
import { aiSettingsStore, recordUsage } from './store'

/** Momentum's AI client, using the providers, models and keys from Settings → AI. */
export const ai = createAiClient({
  getSettings: aiSettingsStore.get,
  getKey: (provider) => getSecret(provider),
  createProvider,
  recordUsage,
  page: currentPage,
})
