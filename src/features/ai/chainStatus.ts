import { createStore } from '@/lib/store'
import { mayAnswer, type ChatEntry } from './chain'
import type { AiErrorKind } from './errors'

/** How one of chat's providers did, last time it was checked or asked. */
export interface EntryStatus {
  state: 'checking' | 'up' | 'down'
  /** When (`Date.now()`). */
  at: number
  /** Why it's down: its kind, and in words. */
  kind?: AiErrorKind
  message?: string
  /** Its models, from the check. */
  models?: string[]
}

/** Chat's providers' status, by entry: shown in Settings and beside a reply. */
export const chainStatusStore = createStore<Record<string, EntryStatus>>({})

export function setEntryStatus(id: string, status: EntryStatus): void {
  chainStatusStore.set((current) => ({ ...current, [id]: status }))
}

/** A provider that's down, in a word: off, busy, or otherwise not answering. */
export function downWord(status: EntryStatus | undefined): string {
  switch (status?.kind) {
    case 'server':
    case 'overloaded':
    case 'rate-limit':
      return 'busy'
    case 'quota':
      return 'out of credit'
    case 'network':
    case 'timeout':
    case 'blocked':
    case undefined:
      return 'offline'
    default:
      return 'not answering'
  }
}

export interface Route {
  /** "Home PC offline, using Mac". */
  text: string
  /** Where the next request goes first, as far as is known. */
  using?: ChatEntry
  /** The ones above it that are down. */
  down: ChatEntry[]
}

/**
 * Where chat's next request will go, from what's known of each provider:
 * the first that may answer, is set up, and isn't known to be down.
 */
export function describeRoute(
  chain: readonly ChatEntry[],
  statuses: Readonly<Record<string, EntryStatus>>,
  ready: (entry: ChatEntry) => boolean = () => true,
): Route {
  const down: ChatEntry[] = []
  const said = () =>
    down
      .map((entry) => `${entry.name} ${downWord(statuses[entry.id])}`)
      .join(', ')
  for (const [index, entry] of chain.entries()) {
    if (!mayAnswer(entry, index) || !ready(entry)) continue
    if (statuses[entry.id]?.state === 'down') {
      down.push(entry)
      continue
    }
    return {
      text:
        down.length === 0
          ? `Using ${entry.name}`
          : `${said()}, using ${entry.name}`,
      using: entry,
      down,
    }
  }
  return {
    text:
      down.length === 0
        ? 'No chat provider is set up'
        : `${said()}: no other provider to use`,
    down,
  }
}
