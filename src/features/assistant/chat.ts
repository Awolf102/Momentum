import {
  ai,
  aiReadiness,
  aiSettingsStore,
  describeAiError,
  isAiError,
  type StopReason,
  type TokenUsage,
} from '@/features/ai'
import { toDateKey } from '@/lib/date'
import { createId } from '@/lib/id'
import { savedSecretsStore } from '@/lib/secrets'
import { createStore } from '@/lib/store'
import { conversations, saveConversation } from './conversations'
import {
  chatMessages,
  LIBRARY_SYSTEM,
  plannerSystem,
  questionContent,
  titleFrom,
} from './lib/prompt'
import { dayName } from './lib/snapshot'
import type { Conversation, Message, SourceRef } from './types'

/** The longest answer, in tokens: plenty for an answer, short of an essay. */
export const ANSWER_TOKENS = 4096

/** Answers being written: each one's text so far, by message id. */
export const liveAnswersStore = createStore<ReadonlyMap<string, string>>(
  new Map(),
)
/** Conversations with an answer being written. */
export const answeringStore = createStore<ReadonlySet<string>>(new Set())

const controllers = new Map<string, AbortController>()

function setAnswering(id: string, on: boolean) {
  answeringStore.set((current) => {
    const next = new Set(current)
    if (on) next.add(id)
    else next.delete(id)
    return next
  })
}

function setLive(id: string, text: string | null) {
  liveAnswersStore.set((current) => {
    const next = new Map(current)
    if (text === null) next.delete(id)
    else next.set(id, text)
    return next
  })
}

/** What goes with a question: passages, or a snapshot of your plans. */
export interface AskContext {
  sources?: SourceRef[]
  snapshot?: string
}

/** The request as it's sent, for a question with its context. */
export function buildRequest(
  conversation: Pick<Conversation, 'mode'>,
  history: readonly Message[],
  question: string,
  context: AskContext,
  now: Date = new Date(),
) {
  return {
    system:
      conversation.mode === 'planner'
        ? plannerSystem(dayName(toDateKey(now)))
        : LIBRARY_SYSTEM,
    messages: chatMessages(history, questionContent(question, context)),
  }
}

async function answer(
  conversation: Conversation,
  question: Message,
  history: readonly Message[],
): Promise<void> {
  const readiness = aiReadiness(
    aiSettingsStore.get(),
    savedSecretsStore.get(),
    'chat',
  )
  const reply: Message = {
    id: createId(),
    role: 'assistant',
    text: '',
    createdAt: new Date().toISOString(),
    provider: readiness.provider,
    model: readiness.ready ? readiness.model : undefined,
    pending: true,
  }
  await saveConversation({
    ...conversation,
    title: conversation.title || titleFrom(question.text),
    messages: [...history, question, reply],
  })

  const controller = new AbortController()
  controllers.set(conversation.id, controller)
  setAnswering(conversation.id, true)
  setLive(reply.id, '')
  const { system, messages } = buildRequest(
    conversation,
    history,
    question.text,
    { sources: question.sources, snapshot: question.snapshot },
  )

  let text = ''
  let usage: TokenUsage | undefined
  let stopReason: StopReason | undefined
  let final: Message
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    for await (const event of ai.chat({
      system,
      messages,
      maxTokens: ANSWER_TOKENS,
      signal: controller.signal,
    })) {
      if (event.type === 'text') {
        text += event.text
        // A few updates a frame's worth apart are plenty to read along.
        timer ??= setTimeout(() => {
          timer = undefined
          setLive(reply.id, text)
        }, 40)
      } else if (event.type === 'usage') usage = event.usage
      else stopReason = event.stopReason
    }
    final = {
      ...reply,
      text,
      usage,
      pending: undefined,
      // Stopped, even if the reply then ended as though it were complete.
      ...(controller.signal.aborted ? { stopped: true } : { stopReason }),
    }
  } catch (error) {
    const stopped =
      controller.signal.aborted ||
      (isAiError(error) && error.kind === 'aborted')
    final = {
      ...reply,
      text,
      usage,
      pending: undefined,
      ...(stopped ? { stopped: true } : { error: describeAiError(error) }),
    }
  } finally {
    clearTimeout(timer)
    controllers.delete(conversation.id)
    setAnswering(conversation.id, false)
    setLive(reply.id, null)
  }
  // Saved into the conversation as it is now (it may have been renamed).
  const latest = conversations.find(conversation.id)
  if (!latest || latest.deletedAt) return
  await saveConversation({
    ...latest,
    messages: latest.messages.map((message) =>
      message.id === reply.id ? final : message,
    ),
  })
}

/** Asks a question in a conversation, sending what's shown with it. */
export async function ask(
  conversationId: string,
  question: string,
  context: AskContext,
): Promise<void> {
  const conversation = conversations.find(conversationId)
  if (!conversation || controllers.has(conversationId) || !question.trim())
    return
  const message: Message = {
    id: createId(),
    role: 'user',
    text: question.trim(),
    createdAt: new Date().toISOString(),
    ...context,
  }
  await answer(conversation, message, conversation.messages)
}

/** Stops the answer being written; what's arrived is kept. */
export function stopAnswer(conversationId: string): void {
  controllers.get(conversationId)?.abort()
}

/**
 * Asks a question again (after an answer failed or was stopped), with what
 * was sent the first time. Anything after it is replaced.
 */
export async function askAgain(
  conversationId: string,
  replyId: string,
): Promise<void> {
  const conversation = conversations.find(conversationId)
  if (!conversation || controllers.has(conversationId)) return
  const index = conversation.messages.findIndex(
    (message) => message.id === replyId,
  )
  const question = conversation.messages[index - 1]
  if (index < 1 || question?.role !== 'user') return
  const history = conversation.messages.slice(0, index - 1)
  await answer(conversation, question, history)
}

/** Whether an answer was cut off when the page closed. */
export const interrupted = (conversationId: string, message: Message) =>
  Boolean(message.pending) && !controllers.has(conversationId)
