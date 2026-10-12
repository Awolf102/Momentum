import { savedSecretsStore } from '@/lib/secrets'
import { useStore } from '@/lib/store'
import { chatRoute, namesInOrder, type ChatRoute } from '../chain'
import { entryReadiness } from '../lib/readiness'
import { localChatStore } from '../local/chatState'
import { PROVIDERS } from '../providers/meta'
import { aiSettingsStore, entryModel } from '../store'

/** Where a chat request would go, and where after that, as settings change. */
export function useChatRoute(): ChatRoute {
  const { chat } = useStore(aiSettingsStore)
  const keys = useStore(savedSecretsStore)
  const localChat = useStore(localChatStore)
  return chatRoute(
    chat.chain,
    (entry) => entryReadiness(entry, keys, localChat).ready,
  )
}

/**
 * Where a chat request goes, in words, to go before what's sent: "Sends to
 * Home PC (qwen3.6:35b; Mac if it can't answer):". The model on this
 * device reads it where it is: nothing is sent.
 */
export function useSendsTo(): string {
  const { first, fallbacks } = useChatRoute()
  if (!first) return 'Sends to your chat provider:'
  const sent = fallbacks.filter((entry) => !PROVIDERS[entry.provider].local)
  if (PROVIDERS[first.provider].local && sent.length === 0)
    return 'Stays on this device: the model running here reads'
  if (PROVIDERS[first.provider].local)
    return `Read on this device first (or, if it can’t answer, sent to ${namesInOrder(sent)}):`
  const then =
    fallbacks.length > 0
      ? `; ${namesInOrder(fallbacks)} if it can’t answer`
      : ''
  return `Sends to ${first.name} (${entryModel(first)}${then}):`
}
