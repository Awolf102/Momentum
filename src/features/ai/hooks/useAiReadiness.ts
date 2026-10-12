import { useEffect } from 'react'
import { savedSecretsStore } from '@/lib/secrets'
import { useStore } from '@/lib/store'
import { aiReadiness, type AiReadiness } from '../lib/readiness'
import { localChatStore } from '../local/chatState'
import { aiSettingsStore, entryModel } from '../store'
import type { AiTask } from '../types'

/** Whether an AI task is set up, updating as settings and keys change. */
export function useAiReadiness(task: AiTask): AiReadiness {
  const settings = useStore(aiSettingsStore)
  const keys = useStore(savedSecretsStore)
  const localChat = useStore(localChatStore)
  // Chat models on this device in chat's list that haven't been looked for.
  const unchecked =
    task === 'chat'
      ? settings.chat.chain
          .filter((entry) => entry.provider === 'browser')
          .map(entryModel)
          .filter(
            (model) =>
              (localChat.files[model]?.status ?? 'unknown') === 'unknown',
          )
          .join(',')
      : ''
  // Whether the model on this device is downloaded is in Cache Storage:
  // look, the first time a feature asks.
  useEffect(() => {
    if (unchecked)
      void import('../local/chatDevice').then(({ localChat }) =>
        localChat.refresh(unchecked.split(',')),
      )
  }, [unchecked])
  return aiReadiness(settings, keys, task, localChat)
}
