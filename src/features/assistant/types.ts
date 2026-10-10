import type { StopReason, TokenUsage } from '@/features/ai'
import type { CollectionRecord } from '@/lib/collection'

/**
 * What a conversation is about: your notes and documents (with page
 * citations), or your tasks, habits, routines, focus time and log.
 */
export type AskMode = 'library' | 'planner'

/** The parts of your plans that can be shared with a question. */
export type PlannerPart = 'tasks' | 'habits' | 'routines' | 'focus' | 'log'

/** A passage sent with a question, so the answer can cite it. */
export interface SourceRef {
  /** `note:<id>` or `document:<id>`. */
  key: string
  kind: 'note' | 'document'
  id: string
  title: string
  page: number | null
  /** The passage, as sent. */
  text: string
}

export interface Message {
  id: string
  role: 'user' | 'assistant'
  text: string
  createdAt: string
  /** A question's passages, as sent with it (numbered in order). */
  sources?: SourceRef[]
  /** A question's snapshot of your plans, as sent with it. */
  snapshot?: string
  /** An answer: where it came from, and how it ended. */
  provider?: string
  model?: string
  stopReason?: StopReason
  usage?: TokenUsage
  /** Why an answer failed, in words to show. */
  error?: string
  /** Stopped before it finished, by you. */
  stopped?: boolean
  /** Still being written (or cut off when the page closed). */
  pending?: boolean
}

export interface Conversation extends CollectionRecord {
  /** From the first question. */
  title: string
  mode: AskMode
  /** Asking about one document only. */
  documentId: string | null
  messages: Message[]
}
