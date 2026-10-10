import { savedSecretsStore } from '@/lib/secrets'
import { useStore } from '@/lib/store'
import { aiReadiness, type AiReadiness } from '../lib/readiness'
import { aiSettingsStore } from '../store'
import type { AiTask } from '../types'

/** Whether an AI task is set up, updating as settings and keys change. */
export function useAiReadiness(task: AiTask): AiReadiness {
  const settings = useStore(aiSettingsStore)
  const keys = useStore(savedSecretsStore)
  return aiReadiness(settings, keys, task)
}
