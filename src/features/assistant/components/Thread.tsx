import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { GlassCard } from '@/components/GlassCard'
import { ChatIcon, LibraryIcon, TrashIcon } from '@/components/icons'
import { IconButton } from '@/components/IconButton'
import { documents } from '@/features/library'
import { navigate, paths } from '@/lib/routes'
import { useStore } from '@/lib/store'
import { toast } from '@/lib/toast'
import {
  answeringStore,
  ask,
  askAgain,
  stopAnswer,
  type AskContext,
} from '../chat'
import {
  conversations,
  deleteConversation,
  restoreConversation,
} from '../conversations'
import type { Conversation, SourceRef } from '../types'
import { Composer } from './Composer'
import { MessageItem } from './MessageItem'

// Ones ending in a space are a start, for you to finish.
const SUGGESTIONS = {
  library: [
    'Summarise my notes on ',
    'Explain simply, with an example: ',
    'Make a revision checklist for ',
  ],
  document: [
    'Summarise this document',
    'What are the key definitions?',
    'Quiz me on it: three questions',
  ],
  planner: [
    'What should I focus on today?',
    'What’s overdue, and what can wait?',
    'How did my week go?',
  ],
}

interface ThreadProps {
  /** A saved conversation, or a new one not yet saved (until it's used). */
  conversation: Conversation
  saved: boolean
}

/** A conversation: its messages, and asking the next question. */
export function Thread({ conversation, saved }: ThreadProps) {
  const answering = useStore(answeringStore).has(conversation.id)
  const documentsList = useStore(documents)
  const document = conversation.documentId
    ? documentsList.find((each) => each.id === conversation.documentId)
    : undefined
  const endRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const composerRef = useRef<HTMLDivElement>(null)
  const count = conversation.messages.length
  const [question, setQuestion] = useState('')
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // New messages scroll into view.
  useLayoutEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' })
  }, [count])
  // At the end, it stays in view as an answer (or the composer) grows;
  // scrolled up to read, you stay where you are.
  useEffect(() => {
    const end = endRef.current
    if (!end) return
    let following = true
    const onScroll = () => {
      following = end.getBoundingClientRect().bottom <= window.innerHeight + 40
    }
    const observer = new ResizeObserver(() => {
      if (following) end.scrollIntoView({ block: 'end' })
    })
    for (const element of [listRef.current, composerRef.current])
      if (element) observer.observe(element)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      observer.disconnect()
      window.removeEventListener('scroll', onScroll)
    }
  }, [])

  async function send(question: string, context: AskContext) {
    if (!saved) {
      // A new conversation is saved when it's first used.
      await conversations.add(conversation)
      navigate(paths.conversation(conversation.id), { replace: true })
    }
    void ask(conversation.id, question, context)
  }

  async function remove() {
    stopAnswer(conversation.id)
    await deleteConversation(conversation.id)
    navigate(paths.assistant)
    toast({
      title: 'Conversation deleted',
      action: {
        label: 'Undo',
        run: () => {
          void restoreConversation(conversation.id)
          navigate(paths.conversation(conversation.id))
        },
      },
    })
  }

  // Each answer cites the passages its question was sent with.
  const citable = useMemo(
    () =>
      conversation.messages.reduce<Array<readonly SourceRef[]>>(
        (list, message) => [
          ...list,
          message.role === 'user'
            ? (message.sources ?? [])
            : (list.at(-1) ?? []),
        ],
        [],
      ),
    [conversation.messages],
  )
  const suggestions =
    SUGGESTIONS[
      conversation.mode === 'planner'
        ? 'planner'
        : conversation.documentId
          ? 'document'
          : 'library'
    ]

  return (
    <div className="flex min-h-[60dvh] flex-col">
      <div className="mb-4 flex items-center gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-linear-to-br from-amber-300/25 to-orange-500/25 text-lg text-orange-300 ring-1 ring-orange-300/30 light:text-orange-500">
          {conversation.documentId ? <LibraryIcon /> : <ChatIcon />}
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-lg font-semibold tracking-tight text-shadow-soft">
            {conversation.title ||
              (conversation.mode === 'planner'
                ? 'Ask about your plans'
                : document
                  ? `Ask about ${document.title}`
                  : 'Ask your notes and documents')}
          </h1>
          <p className="truncate text-xs text-fg-subtle">
            {conversation.mode === 'planner'
              ? 'Tasks, habits, routines, focus time and the log'
              : document
                ? `Only ${document.title}`
                : 'Your notes and documents, with page citations'}
          </p>
        </div>
        {saved && (
          <IconButton
            label="Delete conversation"
            onClick={() => void remove()}
            className="size-9 text-base"
          >
            <TrashIcon />
          </IconButton>
        )}
      </div>

      <div ref={listRef} className="flex-1 space-y-6 pb-6">
        {count === 0 && (
          <GlassCard className="px-5 py-5 sm:px-6">
            <p className="text-sm text-fg-muted">
              {conversation.mode === 'planner'
                ? 'Ask about what’s due, how your week went, or what to do next. You choose which parts of your plans it sees, and can read exactly what’s sent. It can’t change anything.'
                : 'Answers come from your own notes and documents, with numbered citations that open the note or page. You see the passages that go with each question before you send it.'}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {suggestions.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  // Filled in, not sent: what goes with it shows first.
                  onClick={() => {
                    setQuestion(suggestion)
                    inputRef.current?.focus()
                  }}
                  className="rounded-full bg-tint px-3 py-1.5 text-left text-xs text-fg-muted transition hover:bg-line hover:text-fg"
                >
                  {suggestion.endsWith(' ') ? `${suggestion}…` : suggestion}
                </button>
              ))}
            </div>
          </GlassCard>
        )}
        {conversation.messages.map((message, index) => (
          <MessageItem
            key={message.id}
            conversationId={conversation.id}
            message={message}
            sources={citable[index]}
            onAskAgain={
              index === count - 1
                ? (after) =>
                    void askAgain(conversation.id, message.id, { after })
                : undefined
            }
          />
        ))}
      </div>

      <div
        ref={composerRef}
        className="sticky bottom-[calc(env(safe-area-inset-bottom)+5.5rem)] lg:bottom-4"
      >
        <Composer
          conversation={conversation}
          question={question}
          onQuestionChange={setQuestion}
          inputRef={inputRef}
          answering={answering}
          onSend={(question, context) => void send(question, context)}
          onStop={() => stopAnswer(conversation.id)}
        />
      </div>
      {/* Scrolled to, so the newest message shows just above the composer,
          clear of the tab bar on phones. */}
      <div
        ref={endRef}
        className="scroll-mb-[calc(env(safe-area-inset-bottom)+5.5rem)] lg:scroll-mb-4"
      />
    </div>
  )
}
