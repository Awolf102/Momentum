import { useEffect } from 'react'
import { savedSecretsStore } from '@/lib/secrets'
import { useStore } from '@/lib/store'
import { aiReadiness, type AiReadiness } from '../lib/readiness'
import { localChatStore } from '../local/chatState'
import { aiSettingsStore, selection } from '../store'
import type { AiTask } from '../types'

/** Whether an AI task is set up, updating as settings and keys change. */
export function useAiReadiness(task: AiTask): AiReadiness {
  const settings = useStore(aiSettingsStore)
  const keys = useStore(savedSecretsStore)
  const localChat = useStore(localChatStore)
  const { provider, model } = selection(settings, task)
  const unchecked =
    provider === 'browser' &&
    task === 'chat' &&
    (localChat.files[model]?.status ?? 'unknown') === 'unknown'
  // Whether the model on this device is downloaded is in Cache Storage:
  // look, the first time a feature asks.
  useEffect(() => {
    if (unchecked)
      void import('../local/chatDevice').then(({ localChat }) =>
        localChat.refresh([model]),
      )
  }, [unchecked, model])
  return aiReadiness(settings, keys, task, localChat)
}
