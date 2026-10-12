import { createCollection } from '@/lib/collection'
import { isRecord } from '@/lib/guards'
import { createId } from '@/lib/id'
import type { AskMode, Conversation, Message, SourceRef } from './types'

function parseSource(value: unknown): SourceRef | null {
  if (!isRecord(value)) return null
  const { key, kind, id, title, page, text } = value
  if (
    typeof key !== 'string' ||
    (kind !== 'note' && kind !== 'document') ||
    typeof id !== 'string' ||
    typeof text !== 'string'
  )
    return null
  return {
    key,
    kind,
    id,
    title: typeof title === 'string' ? title : '',
    page: typeof page === 'number' ? page : null,
    text,
  }
}

const STOP_REASONS = new Set(['end', 'max-tokens', 'refusal', 'other'])

function parseMessage(value: unknown): Message | null {
  if (!isRecord(value)) return null
  const { id, role, text, createdAt } = value
  if (
    typeof id !== 'string' ||
    (role !== 'user' && role !== 'assistant') ||
    typeof text !== 'string' ||
    typeof createdAt !== 'string'
  )
    return null
  const message: Message = { id, role, text, createdAt }
  if (Array.isArray(value.sources))
    message.sources = value.sources
      .map(parseSource)
      .filter((source) => source !== null)
  if (typeof value.snapshot === 'string') message.snapshot = value.snapshot
  if (typeof value.provider === 'string') message.provider = value.provider
  if (typeof value.model === 'string') message.model = value.model
  if (typeof value.via === 'string') message.via = value.via
  if (typeof value.retryAfter === 'string')
    message.retryAfter = value.retryAfter
  if (
    typeof value.stopReason === 'string' &&
    STOP_REASONS.has(value.stopReason)
  )
    message.stopReason = value.stopReason as Message['stopReason']
  if (
    isRecord(value.usage) &&
    typeof value.usage.inputTokens === 'number' &&
    typeof value.usage.outputTokens === 'number'
  )
    message.usage = {
      inputTokens: value.usage.inputTokens,
      outputTokens: value.usage.outputTokens,
    }
  if (typeof value.error === 'string') message.error = value.error
  if (value.stopped === true) message.stopped = true
  if (value.pending === true) message.pending = true
  return message
}

export function parseConversation(value: unknown): Conversation | null {
  if (!isRecord(value)) return null
  const { id, createdAt, updatedAt, mode, documentId, title } = value
  if (
    typeof id !== 'string' ||
    typeof createdAt !== 'string' ||
    typeof updatedAt !== 'string'
  )
    return null
  return {
    id,
    title: typeof title === 'string' ? title : '',
    mode: mode === 'planner' ? 'planner' : 'library',
    documentId: typeof documentId === 'string' ? documentId : null,
    messages: Array.isArray(value.messages)
      ? value.messages.map(parseMessage).filter((message) => message !== null)
      : [],
    createdAt,
    updatedAt,
    deletedAt: typeof value.deletedAt === 'string' ? value.deletedAt : null,
  }
}

/** Every conversation with the assistant. */
export const conversations = createCollection<Conversation>({
  name: 'conversations',
  parse: parseConversation,
})

export function newConversation(
  mode: AskMode,
  documentId: string | null = null,
  now: Date = new Date(),
): Conversation {
  const stamp = now.toISOString()
  return {
    id: createId(),
    title: '',
    mode,
    documentId,
    messages: [],
    createdAt: stamp,
    updatedAt: stamp,
    deletedAt: null,
  }
}

/** Saves a conversation as it is now (records are replaced, never changed). */
export async function saveConversation(
  conversation: Conversation,
  now: Date = new Date(),
): Promise<Conversation> {
  const next = { ...conversation, updatedAt: now.toISOString() }
  await conversations.put(next)
  return next
}

export async function deleteConversation(id: string, now: Date = new Date()) {
  await conversations.remove(id, now)
}

export async function restoreConversation(id: string, now: Date = new Date()) {
  const conversation = conversations.find(id)
  if (!conversation?.deletedAt) return
  await conversations.put({
    ...conversation,
    deletedAt: null,
    updatedAt: now.toISOString(),
  })
}

/** Newest first. */
export function sortConversations(
  list: readonly Conversation[],
): Conversation[] {
  return [...list].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}
