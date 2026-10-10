import {
  useEffect,
  useId,
  useMemo,
  useState,
  type KeyboardEvent,
  type RefObject,
} from 'react'
import {
  CloseIcon,
  LibraryIcon,
  NoteIcon,
  SendIcon,
  SparkleIcon,
  StopIcon,
} from '@/components/icons'
import { describeAiError, PROVIDERS, useAiReadiness } from '@/features/ai'
import { cn } from '@/lib/cn'
import { useStore } from '@/lib/store'
import type { AskContext } from '../chat'
import { plannerSnapshot } from '../lib/snapshot'
import { gatherSnapshotData } from '../planner'
import { findPassages, meaningAvailable } from '../retrieval'
import {
  assistantSettingsStore,
  PLANNER_PARTS,
  togglePlannerPart,
} from '../settings'
import type { Conversation, SourceRef } from '../types'
import { sourceLabel } from '../lib/sources'

interface ComposerProps {
  conversation: Conversation
  /** The question being written: the thread keeps it, to suggest one. */
  question: string
  onQuestionChange: (question: string) => void
  inputRef: RefObject<HTMLTextAreaElement | null>
  answering: boolean
  onSend: (question: string, context: AskContext) => void
  onStop: () => void
}

const passageKey = (passage: SourceRef) =>
  `${passage.key}\u0001${passage.page ?? ''}\u0001${passage.text}`

const plural = (count: number, one: string, many = `${one}s`) =>
  `${count} ${count === 1 ? one : many}`

/**
 * Where you ask, and see exactly what goes with the question before it's
 * sent: the passages found in your notes and documents (any of which can be
 * taken out), or the parts of your plans you share.
 */
export function Composer({
  conversation,
  question,
  onQuestionChange,
  inputRef,
  answering,
  onSend,
  onStop,
}: ComposerProps) {
  const text = question.trim()
  const readiness = useAiReadiness('chat')
  const destination = readiness.ready
    ? `${PROVIDERS[readiness.provider].label} (${readiness.model})`
    : PROVIDERS[readiness.provider].label
  const earlier = conversation.messages.filter(
    (message) => message.text.trim() && !message.error,
  ).length

  useEffect(() => {
    inputRef.current?.focus()
  }, [inputRef, conversation.id])

  // Library: passages for the question as typed, found on this device.
  const [meaning, setMeaning] = useState<'device' | 'provider' | null>(null)
  useEffect(() => {
    let current = true
    void meaningAvailable().then((found) => current && setMeaning(found))
    return () => {
      current = false
    }
  }, [])
  const [found, setFound] = useState<{
    question: string
    passages: SourceRef[]
    byMeaning: boolean
  } | null>(null)
  const [removed, setRemoved] = useState<ReadonlySet<string>>(new Set())
  const [asking, setAsking] = useState(false)
  const [meaningError, setMeaningError] = useState<{
    question: string
    message: string
  } | null>(null)
  useEffect(() => {
    if (conversation.mode !== 'library' || !text) return
    const controller = new AbortController()
    const timer = setTimeout(() => {
      findPassages(text, {
        documentId: conversation.documentId,
        meaning: meaning === 'device',
        signal: controller.signal,
      }).then(
        (passages) =>
          controller.signal.aborted ||
          setFound({
            question: text,
            passages,
            byMeaning: meaning === 'device',
          }),
        () => {},
      )
    }, 250)
    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [conversation.mode, conversation.documentId, text, meaning])
  const current = found?.question === text ? found : null
  const passages = (current?.passages ?? []).filter(
    (passage) => !removed.has(passageKey(passage)),
  )

  /** With a provider, finding by meaning sends the question: only on request. */
  async function findByMeaning() {
    setAsking(true)
    setMeaningError(null)
    try {
      const passages = await findPassages(text, {
        documentId: conversation.documentId,
        meaning: true,
      })
      setFound({ question: text, passages, byMeaning: true })
    } catch (error) {
      // The passages found by words stay.
      setMeaningError({ question: text, message: describeAiError(error) })
    } finally {
      setAsking(false)
    }
  }

  // Plans: the snapshot of the parts you share, as it would be sent.
  const { plannerParts } = useStore(assistantSettingsStore)
  const parts = useMemo(() => new Set(plannerParts), [plannerParts])
  const [showSnapshot, setShowSnapshot] = useState(false)
  const snapshot = useMemo(
    () =>
      conversation.mode === 'planner' && (text || showSnapshot)
        ? plannerSnapshot(gatherSnapshotData(), parts)
        : '',
    [conversation.mode, parts, text, showSnapshot],
  )

  const [sending, setSending] = useState(false)
  async function send() {
    if (!text || answering || sending) return
    let context: AskContext
    if (conversation.mode === 'planner') {
      context = { snapshot: plannerSnapshot(gatherSnapshotData(), parts) }
    } else if (current) {
      context = { sources: passages }
    } else {
      // Sent before the passages for these exact words were found: find
      // them now (the message shows what went with it).
      setSending(true)
      const fresh = await findPassages(text, {
        documentId: conversation.documentId,
        meaning: meaning === 'device',
      }).catch(() => [])
      setSending(false)
      context = {
        sources: fresh.filter((passage) => !removed.has(passageKey(passage))),
      }
    }
    onSend(text, context)
    onQuestionChange('')
    setRemoved(new Set())
    setShowSnapshot(false)
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (
      event.key === 'Enter' &&
      !event.shiftKey &&
      !event.nativeEvent.isComposing
    ) {
      event.preventDefault()
      void send()
    }
  }

  const snapshotId = useId()
  const shared = PLANNER_PARTS.filter(({ part }) => parts.has(part)).map(
    ({ label }) => label.toLowerCase(),
  )

  return (
    <div className="rounded-[28px] glass-strong p-3">
      <div className="flex items-end gap-2">
        <textarea
          ref={inputRef}
          value={question}
          onChange={(event) => onQuestionChange(event.target.value)}
          onKeyDown={onKeyDown}
          rows={Math.min(6, Math.max(1, question.split('\n').length))}
          // Short enough for one line on a phone.
          placeholder={
            conversation.mode === 'planner'
              ? 'Ask about your plans…'
              : conversation.documentId
                ? 'Ask about this document…'
                : 'Ask your notes and documents…'
          }
          aria-label="Your question"
          className="max-h-48 min-h-11 flex-1 resize-none bg-transparent px-3 py-2.5 text-[15px] leading-relaxed outline-none placeholder:text-fg-subtle focus-visible:outline-none"
        />
        {answering ? (
          <button
            type="button"
            onClick={onStop}
            aria-label="Stop the answer"
            className="flex size-11 shrink-0 items-center justify-center rounded-full bg-tint text-lg transition hover:bg-line"
          >
            <StopIcon />
          </button>
        ) : (
          <button
            type="button"
            onClick={() => void send()}
            disabled={!text || sending}
            aria-label="Send"
            className="flex size-11 shrink-0 items-center justify-center rounded-full bg-linear-to-br from-amber-300 to-orange-500 text-lg text-orange-950 shadow-[0_10px_24px_-12px_rgb(249_115_22/0.8)] transition active:scale-95 disabled:opacity-40 disabled:shadow-none"
          >
            <SendIcon />
          </button>
        )}
      </div>

      <div
        className="space-y-2 px-3 pt-1 pb-1.5"
        role="status"
        aria-live="polite"
      >
        {conversation.mode === 'library' ? (
          <>
            <p className="text-xs leading-relaxed text-fg-subtle">
              {text ? (
                <>
                  Sends to {destination}: your question
                  {passages.length > 0
                    ? `, ${plural(passages.length, 'passage')} from your ${conversation.documentId ? 'document' : 'notes and documents'}`
                    : current
                      ? ' (no passages matched it)'
                      : ''}
                  {earlier > 0
                    ? `, and the ${plural(earlier, 'earlier message')}`
                    : ''}
                  .
                </>
              ) : (
                <>
                  As you type, the passages that will be sent with your question
                  appear here. Nothing is sent until you press Send.
                </>
              )}
            </p>
            {passages.length > 0 && (
              <ul
                className="flex flex-wrap gap-1.5"
                aria-label="Passages to send"
              >
                {passages.map((passage) => (
                  <li key={passageKey(passage)}>
                    <span
                      title={passage.text}
                      className="inline-flex max-w-64 items-center gap-1.5 rounded-full bg-tint py-1 pr-1 pl-2.5 text-xs text-fg-muted"
                    >
                      {passage.kind === 'note' ? (
                        <NoteIcon className="shrink-0" />
                      ) : (
                        <LibraryIcon className="shrink-0" />
                      )}
                      <span className="truncate">{sourceLabel(passage)}</span>
                      <button
                        type="button"
                        onClick={() =>
                          setRemoved((set) =>
                            new Set(set).add(passageKey(passage)),
                          )
                        }
                        aria-label={`Don't send ${sourceLabel(passage)}`}
                        className="flex size-5 shrink-0 items-center justify-center rounded-full transition hover:bg-line hover:text-fg"
                      >
                        <CloseIcon className="text-[0.7rem]" />
                      </button>
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {meaning === 'provider' && text && !current?.byMeaning && (
              <button
                type="button"
                disabled={asking}
                onClick={() => void findByMeaning()}
                className="inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-xs font-semibold text-orange-300 transition hover:bg-tint disabled:opacity-50 light:text-orange-600"
              >
                <SparkleIcon />
                {asking
                  ? 'Finding passages by meaning…'
                  : 'Also find passages by meaning (sends your question to your embeddings provider)'}
              </button>
            )}
            {meaningError?.question === text && (
              <p className="px-2 text-xs text-rose-300 light:text-rose-600">
                Couldn't find passages by meaning: {meaningError.message}
              </p>
            )}
          </>
        ) : (
          <>
            <div
              role="group"
              aria-label="What to share"
              className="flex flex-wrap gap-1.5"
            >
              {PLANNER_PARTS.map(({ part, label }) => {
                const on = parts.has(part)
                return (
                  <button
                    key={part}
                    type="button"
                    aria-pressed={on}
                    onClick={() => togglePlannerPart(part)}
                    className={cn(
                      'rounded-full px-3 py-1 text-xs font-medium transition',
                      on
                        ? 'bg-fg/12 text-fg'
                        : 'text-fg-subtle line-through hover:bg-tint',
                    )}
                  >
                    {label}
                  </button>
                )
              })}
            </div>
            <p className="text-xs leading-relaxed text-fg-subtle">
              Sends to {destination}: your question, today’s date and streak
              {shared.length ? `, your ${shared.join(', ')}` : ''}
              {earlier > 0
                ? `, and the ${plural(earlier, 'earlier message')}`
                : ''}
              .{' '}
              <button
                type="button"
                aria-expanded={showSnapshot}
                aria-controls={snapshotId}
                onClick={() => setShowSnapshot((shown) => !shown)}
                className="font-semibold text-fg-muted underline-offset-2 hover:underline"
              >
                {showSnapshot ? 'Hide it' : 'Show exactly what’s sent'}
              </button>
            </p>
            {showSnapshot && (
              <pre
                id={snapshotId}
                className="max-h-36 overflow-auto rounded-2xl bg-tint p-3 font-mono text-[11px] leading-relaxed whitespace-pre-wrap text-fg-muted sm:max-h-56"
              >
                {snapshot}
              </pre>
            )}
          </>
        )}
      </div>
    </div>
  )
}
