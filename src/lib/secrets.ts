import { getDb, indexedDbAvailable } from './db/db'
import { createStore } from './store'

/**
 * API keys and similar secrets. They live in their own IndexedDB object store,
 * separate from every persistent store, so they are never broadcast to other
 * tabs, never logged, and only included in a backup when the user asks.
 * The UI never reads a secret back in full — only whether one is saved.
 */
const memory = new Map<string, string>()

/**
 * Saved secrets by name, each with a masked hint ("sk-ant…a1b2") so the UI
 * can show which key is saved without ever displaying it.
 */
export const savedSecretsStore = createStore<ReadonlyMap<string, string>>(
  new Map(),
)

async function refreshNames(): Promise<void> {
  const all = await getAllSecrets()
  savedSecretsStore.set(
    new Map(
      Object.entries(all).map(([name, value]) => [name, maskSecret(value)]),
    ),
  )
}

export async function loadSecretNames(): Promise<void> {
  try {
    await refreshNames()
  } catch {
    savedSecretsStore.set(
      new Map([...memory].map(([name, value]) => [name, maskSecret(value)])),
    )
  }
}

export async function getSecret(name: string): Promise<string | undefined> {
  if (!indexedDbAvailable()) return memory.get(name)
  try {
    return await (await getDb()).get('secrets', name)
  } catch {
    return memory.get(name)
  }
}

export async function setSecret(name: string, value: string): Promise<void> {
  const trimmed = value.trim()
  if (!trimmed) return deleteSecret(name)
  try {
    await (await getDb()).put('secrets', trimmed, name)
  } catch {
    memory.set(name, trimmed)
  }
  await refreshNames().catch(() => {})
}

export async function deleteSecret(name: string): Promise<void> {
  memory.delete(name)
  try {
    await (await getDb()).delete('secrets', name)
  } catch {
    // Nothing stored.
  }
  await refreshNames().catch(() => {})
}

export async function getAllSecrets(): Promise<Record<string, string>> {
  const result: Record<string, string> = Object.fromEntries(memory)
  if (!indexedDbAvailable()) return result
  try {
    const db = await getDb()
    const tx = db.transaction('secrets')
    const [keys, values] = await Promise.all([
      tx.store.getAllKeys(),
      tx.store.getAll(),
    ])
    keys.forEach((key, index) => (result[key] = values[index]))
  } catch {
    // Memory only.
  }
  return result
}

/** A masked version for display: "sk-ant…a1b2". */
export function maskSecret(value: string): string {
  if (value.length <= 8) return '••••'
  return `${value.slice(0, 6)}…${value.slice(-4)}`
}
