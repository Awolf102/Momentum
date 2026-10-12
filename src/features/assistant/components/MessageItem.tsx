import { useId, useState } from 'react'
import { Link } from 'wouter'
import { AlertIcon, LibraryIcon, NoteIcon, UndoIcon } from '@/components/icons'
import { formatTokens, ReplyStatus } from '@/features/ai'
import { useStore } from '@/lib/store'
import { interrupted, liveAnswersStore } from '../chat'
import type { Message, SourceRef } from '../types'
import { sourceHref, sourceLabel } from '../lib/sources'
import { Answer } from './Answer'

const plural = (count: number, one: string, many = `${one}s`) =>
  `${count} ${count === 1 ? one : many}`

/** What went with a question, to look at afterwards. */
function SentWith({ message }: { message: Message }) {
  const [open, setOpen] = useState(false)
  const id = useId()
  const sources = message.sources
  if (!sources && message.snapshot === undefined) return null
  const summary = sources
    ? sources.length
      ? `Sent with ${plural(sources.length, 'passage')}`
      : 'Sent without passages (none matched)'
    : 'Sent with a snapshot of your plans'
  const openable = (sources && sources.length > 0) || message.snapshot
  return (
    <div className="mt-2 text-xs text-fg-subtle">
      {openable ? (
        <button
          type="button"
          aria-expanded={open}
          aria-controls={id}
          onClick={() => setOpen((shown) => !shown)}
          className="font-medium underline-offset-2 hover:text-fg-muted hover:underline"
        >
          {summary} {open ? '▴' : '▾'}
        </button>
      ) : (
        summary
      )}
      {open && sources && (
        <ol id={id} className="mt-2 space-y-1.5">
          {sources.map((source, index) => (
            <li key={index} className="flex gap-2">
              <span className="w-4 shrink-0 text-right font-semibold tabular-nums">
                {index + 1}
              </span>
              <span className="min-w-0">
                <Link
                  href={sourceHref(source)}
                  className="inline-flex items-center gap-1 font-medium text-fg-muted hover:text-fg hover:underline"
                >
                  {source.kind === 'note' ? <NoteIcon /> : <LibraryIcon />}
                  {sourceLabel(source)}
                </Link>
                <span className="mt-0.5 line-clamp-3 leading-relaxed">
                  {source.text}
                </span>
              </span>
            </li>
          ))}
        </ol>
      )}
      {open && message.snapshot !== undefined && (
        <pre
          id={id}
          className="mt-2 max-h-72 overflow-auto rounded-2xl bg-tint p-3 font-mono text-[11px] leading-relaxed whitespace-pre-wrap"
        >
          {message.snapshot}
        </pre>
      )}
    </div>
  )
}

interface MessageItemProps {
  conversationId: string
  message: Message
  /** For an answer: the sources its question was sent with. */
  sources: readonly SourceRef[]
  onAskAgain?: () => void
}

export function MessageItem({
  conversationId,
  message,
  sources,
  onAskAgain,
}: MessageItemProps) {
  const live = useStore(liveAnswersStore).get(message.id)

  if (message.role === 'user') {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-[22px] rounded-br-md bg-fg/10 px-4 py-3">
          <p className="text-[15px] leading-relaxed whitespace-pre-wrap">
            {message.text}
          </p>
          <SentWith message={message} />
        </div>
      </div>
    )
  }

  const text = live ?? message.text
  const writing = live !== undefined
  const cutOff = interrupted(conversationId, message)
  return (
    <div className="max-w-full">
      {text ? (
        <Answer text={text} sources={sources} />
      ) : writing ? (
        <ReplyStatus since={Date.parse(message.createdAt)} />
      ) : null}
      {message.error && (
        <p className="mt-2 flex items-start gap-1.5 text-sm text-rose-300 light:text-rose-600">
          <AlertIcon className="mt-0.5 shrink-0" />
          {message.error}
        </p>
      )}
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-fg-subtle">
        {message.stopped && <span>Stopped.</span>}
        {cutOff && <span>The page closed before this finished.</span>}
        {message.stopReason === 'max-tokens' && (
          <span>
            {text
              ? 'Cut off at the length limit.'
              : 'Cut off at the length limit while thinking: no answer came.'}
          </span>
        )}
        {message.stopReason === 'refusal' && (
          <span>The model declined to answer.</span>
        )}
        {!writing && message.model && (
          <span>
            {message.model}
            {message.usage
              ? ` · ${formatTokens(message.usage.inputTokens)} in · ${formatTokens(message.usage.outputTokens)} out`
              : ''}
          </span>
        )}
        {onAskAgain &&
          !writing &&
          (message.error || message.stopped || cutOff) && (
            <button
              type="button"
              onClick={onAskAgain}
              className="inline-flex items-center gap-1 font-semibold text-fg-muted transition hover:text-fg"
            >
              <UndoIcon /> Ask again
            </button>
          )}
      </div>
    </div>
  )
}
