import { useMemo, useState } from 'react'
import { Link, Redirect, useParams, useSearch } from 'wouter'
import { ChatIcon, CloseIcon } from '@/components/icons'
import { SegmentedControl } from '@/components/SegmentedControl'
import { AiGate } from '@/features/ai'
import { conversations, type AskMode } from '@/features/assistant'
import {
  ConversationList,
  NewConversationButton,
  newConversation,
  sortConversations,
  Thread,
} from '@/features/assistant/page'
import { documents } from '@/features/library'
import { cn } from '@/lib/cn'
import { navigate, paths } from '@/lib/routes'
import { useStore } from '@/lib/store'

const MODES = [
  { value: 'library' as const, label: 'Notes & documents' },
  { value: 'planner' as const, label: 'Your plans' },
]

export default function AssistantPage() {
  const { id } = useParams<{ id?: string }>()
  const params = new URLSearchParams(useSearch())
  const mode: AskMode = params.get('mode') === 'planner' ? 'planner' : 'library'
  const documentId = mode === 'library' ? params.get('document') : null
  const all = useStore(conversations)
  const sorted = useMemo(() => sortConversations(all), [all])
  const library = useStore(documents)
  const scope = documentId
    ? library.find((document) => document.id === documentId)
    : undefined
  // A new conversation isn't saved until its first question.
  const draft = useMemo(
    () => newConversation(mode, documentId),
    [mode, documentId],
  )
  const [listOpen, setListOpen] = useState(false)
  const saved = id
    ? all.find((conversation) => conversation.id === id)
    : undefined
  // A link to a conversation that's gone (deleted, or from another device).
  if (id && !saved) return <Redirect to={paths.assistant} replace />
  const conversation = saved ?? draft

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col pt-2 pb-8 sm:pt-6 lg:pt-2">
      <AiGate task="chat" feature="The assistant">
        <div className="grid items-start gap-6 lg:grid-cols-[17rem_minmax(0,1fr)]">
          <div
            className={cn(
              'flex flex-col gap-4 lg:sticky lg:top-8 lg:max-h-[calc(100dvh-4rem)]',
              !listOpen && 'max-lg:hidden',
            )}
          >
            <div className="flex items-end justify-between gap-4">
              <h1 className="font-serif text-5xl leading-none tracking-tight text-shadow-soft sm:text-6xl">
                Ask
              </h1>
              {(saved || sorted.length > 0) && <NewConversationButton />}
            </div>
            <ConversationList conversations={sorted} currentId={id} />
          </div>
          <div className="flex min-w-0 flex-col">
            {sorted.length > 0 && (
              <button
                type="button"
                onClick={() => setListOpen((open) => !open)}
                className="mb-3 inline-flex items-center gap-1.5 self-start rounded-full px-2 py-1 text-sm font-medium text-fg-muted transition text-shadow-soft hover:text-fg lg:hidden"
              >
                <ChatIcon />
                {listOpen ? 'Hide past conversations' : 'Past conversations'}
              </button>
            )}
            {!saved && (
              <div className="mb-4 flex flex-wrap items-center gap-2">
                <div className="w-full sm:w-auto sm:min-w-96">
                  <SegmentedControl
                    label="Ask about"
                    value={mode}
                    options={MODES}
                    onChange={(next) =>
                      navigate(
                        next === 'planner'
                          ? paths.ask('planner')
                          : paths.assistant,
                        { replace: true },
                      )
                    }
                  />
                </div>
                {scope && (
                  <Link
                    href={paths.assistant}
                    replace
                    className="inline-flex items-center gap-1.5 rounded-full bg-tint px-3 py-1.5 text-xs font-medium text-fg-muted transition hover:bg-line"
                  >
                    Only {scope.title}
                    <CloseIcon aria-label="Ask about everything" role="img" />
                  </Link>
                )}
              </div>
            )}
            <Thread
              key={conversation.id}
              conversation={conversation}
              saved={Boolean(saved)}
            />
          </div>
        </div>
      </AiGate>
    </div>
  )
}
