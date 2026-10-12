import { keyNameOf, mayAnswer, type ChatEntry } from '../chain'
import { chatModelStored, type LocalChatState } from '../local/chatState'
import { PROVIDERS } from '../providers/meta'
import { entryModel, selection, type AiSettings } from '../store'
import type { AiTask, ProviderId } from '../types'

export type NotReadyReason =
  'no-key' | 'no-model' | 'no-address' | 'not-downloaded'

export type AiReadiness =
  | {
      ready: true
      provider: ProviderId
      model: string
      /** For chat: the first provider in its list that's set up. */
      entry?: ChatEntry
    }
  | { ready: false; provider: ProviderId; reason: NotReadyReason }

type Keys = { has(name: string): boolean }

/** Whether one of chat's providers is set up: a key, an address, a model. */
export function entryReadiness(
  entry: ChatEntry,
  savedKeys: Keys,
  localChat?: LocalChatState,
): { ready: true } | { ready: false; reason: NotReadyReason } {
  const key = keyNameOf(entry)
  if (PROVIDERS[entry.provider].needsKey && (!key || !savedKeys.has(key)))
    return { ready: false, reason: 'no-key' }
  if (entry.provider === 'compatible' && !entry.baseUrl.trim())
    return { ready: false, reason: 'no-address' }
  const model = entryModel(entry)
  if (!model) return { ready: false, reason: 'no-model' }
  // Known not to be downloaded (unknown until Settings or a request looks).
  if (
    entry.provider === 'browser' &&
    localChat &&
    chatModelStored(localChat, model) === false
  )
    return { ready: false, reason: 'not-downloaded' }
  return { ready: true }
}

/**
 * Whether an AI task can run. For chat: whether any provider in its list
 * that may answer is set up (the first that is, is where it goes first).
 */
export function aiReadiness(
  settings: AiSettings,
  savedKeys: Keys,
  task: AiTask,
  /** The chat model on this device: whether it's downloaded, once known. */
  localChat?: LocalChatState,
): AiReadiness {
  if (task === 'chat') {
    const { chain } = settings.chat
    for (const [index, entry] of chain.entries()) {
      if (!mayAnswer(entry, index)) continue
      if (entryReadiness(entry, savedKeys, localChat).ready)
        return {
          ready: true,
          provider: entry.provider,
          model: entryModel(entry),
          entry,
        }
    }
    const first = chain[0]
    const why = entryReadiness(first, savedKeys, localChat)
    return {
      ready: false,
      provider: first.provider,
      reason: why.ready ? 'no-model' : why.reason,
    }
  }
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
