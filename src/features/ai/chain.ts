/**
 * Chat's providers, in order. Each entry is what one provider has always
 * been (a kind, an address for a compatible server, a key and a model),
 * kept per entry so two Ollama servers and OpenRouter can sit side by side.
 * Requests go to the first that can answer (see `client.ts`). Pure.
 */
import { isRecord } from '@/lib/guards'
import { createId } from '@/lib/id'
import type { AiError, AiErrorKind } from './errors'
import { CHAT_PROVIDER_IDS, PROVIDERS } from './providers/meta'
import type { ChatProviderId, ChatSource } from './types'

export interface ChatEntry {
  /** Names its key (`chat:<id>`) and its usage; never changes. */
  id: string
  provider: ChatProviderId
  /** What you call it: "Home PC". */
  name: string
  /** A compatible server's address. */
  baseUrl: string
  model: string
  /**
   * A cloud provider below the first is used only when this is on: your
   * text goes to it when the ones above can't answer.
   */
  fallback: boolean
  /**
   * Where a compatible server's key is kept, when not its own: the server
   * set up before chat had a list keeps the key it always had.
   */
  keyName?: string
}

/** The key the one compatible server used before chat had a list. */
export const LEGACY_COMPATIBLE_KEY = 'compatible'

/** Who wrote a reply, to show and keep with it: "Home PC · qwen3.6:35b". */
export function formatSource(
  source: Pick<ChatSource, 'name' | 'model'>,
): string {
  return `${source.name} · ${source.model}`
}

/** The name of an entry's key in `secrets`, if it has one. */
export function keyNameOf(entry: ChatEntry): string | undefined {
  if (entry.provider === 'browser') return undefined
  if (entry.provider !== 'compatible') return entry.provider
  return entry.keyName ?? `chat:${entry.id}`
}

/**
 * Who usage is counted against: each compatible server apart
 * (`compatible@<id>`), except the one from before the list, which keeps
 * its history; Anthropic and OpenAI by account, as before.
 */
export function usageProviderOf(entry: ChatEntry): string {
  if (entry.provider !== 'compatible') return entry.provider
  return entry.keyName === LEGACY_COMPATIBLE_KEY
    ? 'compatible'
    : `compatible@${entry.id}`
}

/**
 * What usage counted against `provider` (see `usageProviderOf`) is called:
 * the server's name in chat's list, else the provider's.
 */
export function usageLabel(
  provider: string,
  chain: readonly ChatEntry[],
): string {
  const entry = chain.find((each) => usageProviderOf(each) === provider)
  if (entry && entry.provider === 'compatible') return entry.name
  if (provider.startsWith('compatible@')) return 'A removed server'
  return PROVIDERS[provider as ChatProviderId]?.label ?? provider
}

/**
 * Addresses on your own machines: this one, the local network, `.local`
 * names, and Tailscale (`*.ts.net`, and its 100.64.0.0/10 addresses).
 */
export function isPrivateAddress(address: string): boolean {
  let host: string
  try {
    host = new URL(address).hostname.toLowerCase().replace(/^\[|\]$/g, '')
  } catch {
    return false
  }
  if (!host.includes('.') && !host.includes(':')) return true
  if (/(^|\.)(localhost|local|lan|internal|home\.arpa|ts\.net)$/.test(host))
    return true
  const v4 = /^(\d+)\.(\d+)\.\d+\.\d+$/.exec(host)
  if (v4) {
    const [a, b] = [Number(v4[1]), Number(v4[2])]
    return (
      a === 10 ||
      a === 127 ||
      (a === 192 && b === 168) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 169 && b === 254) ||
      (a === 100 && b >= 64 && b <= 127)
    )
  }
  return host === '::1' || /^f[cd]/.test(host) || /^fe[89ab]/.test(host)
}

/** Whether an entry sends your text to a service you don't run. */
export function isCloud(entry: ChatEntry): boolean {
  if (entry.provider === 'browser') return false
  if (entry.provider === 'compatible') return !isPrivateAddress(entry.baseUrl)
  return true
}

/**
 * Whether an entry may answer: the first always (you chose it); one below,
 * if it's yours (a home server, this device), or a cloud one you allowed.
 */
export function mayAnswer(entry: ChatEntry, index: number): boolean {
  return index === 0 || !isCloud(entry) || entry.fallback
}

/** Where chat requests go: the first that may answer and is set up, then the rest. */
export interface ChatRoute {
  first?: ChatEntry
  /** Asked in order when the ones before can't answer. */
  fallbacks: ChatEntry[]
}

export function chatRoute(
  chain: readonly ChatEntry[],
  ready: (entry: ChatEntry) => boolean,
): ChatRoute {
  const usable = chain.filter(
    (entry, index) => mayAnswer(entry, index) && ready(entry),
  )
  return { first: usable[0], fallbacks: usable.slice(1) }
}

/** "Mac, then OpenRouter". */
export function namesInOrder(entries: readonly ChatEntry[]): string {
  return entries.map((entry) => entry.name).join(', then ')
}

/** A new entry of a kind, named so it can be told from the others. */
export function newEntry(
  provider: ChatProviderId,
  existing: readonly ChatEntry[],
  id: string = createId(),
): ChatEntry {
  const label = PROVIDERS[provider].label
  const same = existing.filter((entry) => entry.provider === provider).length
  return {
    id,
    provider,
    name: same === 0 ? label : `${label} ${same + 1}`,
    baseUrl: '',
    model: '',
    fallback: false,
  }
}

function parseEntry(value: unknown): ChatEntry | null {
  if (!isRecord(value) || typeof value.id !== 'string' || !value.id) return null
  if (!CHAT_PROVIDER_IDS.includes(value.provider as ChatProviderId)) return null
  const text = (field: unknown) => (typeof field === 'string' ? field : '')
  return {
    id: value.id,
    provider: value.provider as ChatProviderId,
    name:
      text(value.name).trim() ||
      PROVIDERS[value.provider as ChatProviderId].label,
    baseUrl: text(value.baseUrl),
    model: text(value.model),
    fallback: value.fallback === true,
    ...(typeof value.keyName === 'string' && value.keyName
      ? { keyName: value.keyName }
      : {}),
  }
}

/** The list as saved; entries that can't be read are left out. */
export function parseChain(value: unknown): ChatEntry[] | null {
  if (!Array.isArray(value)) return null
  const seen = new Set<string>()
  const chain: ChatEntry[] = []
  for (const item of value) {
    const entry = parseEntry(item)
    if (!entry || seen.has(entry.id)) continue
    seen.add(entry.id)
    chain.push(entry)
  }
  return chain.length > 0 ? chain : null
}

/**
 * Chat settings from before the list (one provider, a model per provider,
 * one shared compatible address): the provider that was chosen becomes the
 * first, and only, entry. Its key stays where it was.
 */
export function migrateChat(
  legacy: unknown,
  compatibleBaseUrl: string,
): ChatEntry[] {
  const provider =
    isRecord(legacy) &&
    CHAT_PROVIDER_IDS.includes(legacy.provider as ChatProviderId)
      ? (legacy.provider as ChatProviderId)
      : 'anthropic'
  const models =
    isRecord(legacy) && isRecord(legacy.models) ? legacy.models : {}
  const model = models[provider]
  return [
    {
      id: 'primary',
      provider,
      name: PROVIDERS[provider].label,
      baseUrl: provider === 'compatible' ? compatibleBaseUrl : '',
      model: typeof model === 'string' ? model : '',
      fallback: false,
      ...(provider === 'compatible' ? { keyName: LEGACY_COMPATIBLE_KEY } : {}),
    },
  ]
}

/**
 * Failures that are about one provider (it's off, asleep, busy, missing the
 * model, can't run here, turned the key away), so the next may answer. Not
 * ones that would fail anywhere: a request it couldn't accept (malformed,
 * too long), or being cancelled.
 */
const FAIL_OVER: ReadonlySet<AiErrorKind> = new Set<AiErrorKind>([
  'network',
  'timeout',
  'server',
  'overloaded',
  'not-found',
  'blocked',
  'unavailable',
  'memory',
  'unsupported',
  'auth',
  'permission',
  'quota',
  'rate-limit',
  'no-key',
  'no-model',
])

export function failsOver(error: AiError): boolean {
  return FAIL_OVER.has(error.kind)
}
