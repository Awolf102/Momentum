import { PROVIDERS } from '../providers/meta'
import { selection, type AiSettings } from '../store'
import type { AiTask, ProviderId } from '../types'

export type AiReadiness =
  | { ready: true; provider: ProviderId; model: string }
  | {
      ready: false
      provider: ProviderId
      reason: 'no-key' | 'no-model' | 'no-address'
    }

/** Whether an AI task can run: a key (if needed), an address and a model. */
export function aiReadiness(
  settings: AiSettings,
  savedKeys: { has(name: string): boolean },
  task: AiTask,
): AiReadiness {
  const { provider, model } = selection(settings, task)
  if (PROVIDERS[provider].needsKey && !savedKeys.has(provider)) {
    return { ready: false, provider, reason: 'no-key' }
  }
  if (provider === 'compatible' && !settings.compatibleBaseUrl.trim()) {
    return { ready: false, provider, reason: 'no-address' }
  }
  if (!model) return { ready: false, provider, reason: 'no-model' }
  return { ready: true, provider, model }
}
