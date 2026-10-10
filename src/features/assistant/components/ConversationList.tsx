import { Link } from 'wouter'
import { GlassCard } from '@/components/GlassCard'
import {
  CalendarCheckIcon,
  ChatIcon,
  LibraryIcon,
  PlusIcon,
} from '@/components/icons'
import { formatEdited } from '@/features/notes'
import { cn } from '@/lib/cn'
import { paths } from '@/lib/routes'
import { useStore } from '@/lib/store'
import { answeringStore } from '../chat'
import type { Conversation } from '../types'

export function NewConversationButton({ className }: { className?: string }) {
  return (
    <Link
      href={paths.assistant}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full bg-linear-to-br from-amber-300 to-orange-500 px-4 py-2 text-sm font-semibold text-orange-950 shadow-[0_10px_24px_-12px_rgb(249_115_22/0.8)] transition-shadow hover:shadow-[0_12px_28px_-10px_rgb(249_115_22/0.9)]',
        className,
      )}
    >
      <PlusIcon /> New
    </Link>
  )
}

/** Past conversations, newest first. */
export function ConversationList({
  conversations,
  currentId,
}: {
  conversations: readonly Conversation[]
  currentId?: string
}) {
  const answering = useStore(answeringStore)
  if (conversations.length === 0) return null
  return (
    <GlassCard
      as="ul"
      className="min-h-0 overflow-y-auto overscroll-contain p-1.5"
    >
      {conversations.map((conversation) => {
        const current = conversation.id === currentId
        const last = conversation.messages.at(-1)
        return (
          <li key={conversation.id}>
            <Link
              href={paths.conversation(conversation.id)}
              aria-current={current ? 'page' : undefined}
              className={cn(
                'flex gap-3 rounded-[22px] px-4 py-3 transition',
                current ? 'bg-fg/10' : 'hover:bg-tint',
              )}
            >
              <span className="mt-0.5 shrink-0 text-base text-fg-subtle">
                {conversation.mode === 'planner' ? (
                  <CalendarCheckIcon />
                ) : conversation.documentId ? (
                  <LibraryIcon />
                ) : (
                  <ChatIcon />
                )}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">
                  {conversation.title || 'New conversation'}
                </span>
                {last && last.role === 'assistant' && last.text && (
                  <span className="mt-0.5 line-clamp-2 text-sm leading-snug text-fg-muted">
                    {last.text.replace(/[#*_`>$[\]]/g, '').slice(0, 160)}
                  </span>
                )}
                <span className="mt-1 block text-xs text-fg-subtle">
                  {answering.has(conversation.id) ? (
                    'Answering…'
                  ) : (
                    <time dateTime={conversation.updatedAt}>
                      {formatEdited(conversation.updatedAt)}
                    </time>
                  )}
                </span>
              </span>
            </Link>
          </li>
        )
      })}
    </GlassCard>
  )
}
