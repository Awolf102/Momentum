import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'wouter'
import {
  ArrowLeftIcon,
  LibraryIcon,
  NoteIcon,
  UndoIcon,
} from '@/components/icons'
import { documents } from '@/features/library'
import { notes } from '@/features/notes'
import { MarkdownView } from '@/features/notes/view'
import { findSubject, SubjectDot, subjectsStore } from '@/features/subjects'
import { cn } from '@/lib/cn'
import { useHotkeys } from '@/lib/hotkeys'
import { paths } from '@/lib/routes'
import { useStore } from '@/lib/store'
import { useClock } from '@/lib/useClock'
import { useCards } from '../hooks/useCards'
import { describeInterval, describeWhen } from '../lib/format'
import { buildQueue, dueCounts, nextDue } from '../lib/queue'
import { rateCard, saveRating, undoRating, type Rated } from '../review'
import { createScheduler, type Outcomes } from '../scheduler'
import { cardSettingsStore } from '../settings'
import type { FlashCard, Rating } from '../types'
import { editCardStore } from '../editing'

const RATINGS: ReadonlyArray<{ rating: Rating; label: string; tone: string }> =
  [
    { rating: 1, label: 'Again', tone: 'text-rose-300 light:text-rose-600' },
    { rating: 2, label: 'Hard', tone: 'text-amber-200 light:text-amber-700' },
    {
      rating: 3,
      label: 'Good',
      tone: 'text-emerald-300 light:text-emerald-700',
    },
    { rating: 4, label: 'Easy', tone: 'text-sky-300 light:text-sky-700' },
  ]

/** The time, read in event handlers (never while rendering). */
const timeNow = () => new Date()

const plural = (count: number, one: string, many = `${one}s`) =>
  `${count} ${count === 1 ? one : many}`

/** Where a card came from, as a link back there. */
function SourceLink({ card }: { card: FlashCard }) {
  const allNotes = useStore(notes)
  const allDocuments = useStore(documents)
  const source = card.source
  if (!source) return null
  if (source.kind === 'note') {
    const note = allNotes.find((each) => each.id === source.id)
    if (!note) return null
    return (
      <Link
        href={paths.note(note.id)}
        className="inline-flex min-w-0 items-center gap-1 hover:text-fg"
      >
        <NoteIcon className="shrink-0" />
        <span className="truncate">{note.title || 'Untitled'}</span>
      </Link>
    )
  }
  const document = allDocuments.find((each) => each.id === source.id)
  if (!document) return null
  return (
    <Link
      href={paths.document(document.id, source.page ?? undefined)}
      className="inline-flex min-w-0 items-center gap-1 hover:text-fg"
    >
      <LibraryIcon className="shrink-0" />
      <span className="truncate">
        {document.title}
        {source.page ? `, p. ${source.page}` : ''}
      </span>
    </Link>
  )
}

interface Shown {
  cardId: string
  at: number
  /** What each rating would do, worked out when the answer was shown. */
  outcomes: Outcomes | null
}

/**
 * Studying the cards that are due: the question, then the answer, then how
 * well you remembered it. Space shows the answer, 1–4 rate it, Z undoes.
 */
export function ReviewSession({ subjectId }: { subjectId?: string | null }) {
  const all = useCards()
  const settings = useStore(cardSettingsStore)
  // Subject names and colours, as they change.
  useStore(subjectsStore)
  const clock = useClock()
  const scheduler = useMemo(
    () => createScheduler({ retention: settings.retention }),
    [settings.retention],
  )

  const [ratedAt, setRatedAt] = useState<Date | null>(null)
  const now = ratedAt && ratedAt > clock ? ratedAt : clock
  const [history, setHistory] = useState<Rated[]>([])
  const [lastId, setLastId] = useState<string | null>(null)
  const [againId, setAgainId] = useState<string | null>(null)
  const [shown, setShown] = useState<Shown | null>(null)
  const [busy, setBusy] = useState(false)
  // Keys can come faster than React re-renders: what's showing and what's
  // been rated are read from refs, so a rating right after Space counts, a
  // key pressed twice rates a card once, and Undo takes back the last one.
  const showing = useRef<Shown | null>(null)
  const rated = useRef<Rated[]>([])
  // Undo waits for the rating it takes back to be saved.
  const saving = useRef<Promise<void>>(Promise.resolve())
  const undoing = useRef(false)

  const queue = buildQueue(all, {
    now,
    newPerDay: settings.newPerDay,
    subjectId,
  })
  // Not the card just answered twice running, while there are others; a
  // card brought back by Undo comes first.
  const card =
    queue.find((each) => each.id === againId) ??
    queue.find((each) => each.id !== lastId) ??
    queue[0]
  const revealed = Boolean(
    card && shown && shown.cardId === card.id && shown.outcomes,
  )

  // When the card came up, for how long the answer took.
  const shownAt = useRef({ id: '', at: 0 })
  useEffect(() => {
    if (card && shownAt.current.id !== card.id)
      shownAt.current = { id: card.id, at: Date.now() }
  }, [card])

  function reveal() {
    if (!card || revealed) return
    const at = timeNow()
    const next = {
      cardId: card.id,
      at: at.getTime(),
      outcomes: scheduler.outcomes(card.schedule, at),
    }
    showing.current = next
    setShown(next)
  }

  function rate(rating: Rating) {
    const current = showing.current
    if (!card || current?.cardId !== card.id || !current.outcomes) return
    const at = timeNow()
    const result = rateCard(card, rating, current.outcomes[rating], {
      now: at,
      durationMs:
        shownAt.current.id === card.id
          ? at.getTime() - shownAt.current.at
          : null,
    })
    showing.current = null
    rated.current = [...rated.current, result]
    // Into the session as the card is saved, so the summary and the queue
    // agree.
    setHistory(rated.current)
    setLastId(card.id)
    setAgainId(null)
    setShown(null)
    setRatedAt(at)
    saving.current = saveRating(result, at).catch((error: unknown) =>
      console.error('[momentum] A rating could not be saved.', error),
    )
  }

  async function undo() {
    const last = rated.current.at(-1)
    if (!last || undoing.current) return
    undoing.current = true
    setBusy(true)
    try {
      await saving.current
      await undoRating(last)
      rated.current = rated.current.slice(0, -1)
      setHistory(rated.current)
      setAgainId(last.card.id)
      setLastId(null)
      showing.current = null
      setShown(null)
    } finally {
      undoing.current = false
      setBusy(false)
    }
  }

  useHotkeys([
    { key: ' ', run: reveal },
    { key: 'Enter', run: reveal },
    { key: '1', run: () => rate(1) },
    { key: '2', run: () => rate(2) },
    { key: '3', run: () => rate(3) },
    { key: '4', run: () => rate(4) },
    { key: 'z', run: () => void undo() },
    { key: 'e', run: () => card && editCardStore.set(card.id) },
  ])

  const left = dueCounts(all, { now, newPerDay: settings.newPerDay, subjectId })
  const subject = findSubject(subjectId)
  const remembered = history.filter((rated) => rated.review.rating > 1).length
  const header = (
    <div className="mb-4 flex items-center gap-3">
      <Link
        href={paths.cards}
        aria-label="Back to cards"
        className="flex size-10 shrink-0 items-center justify-center rounded-full glass text-lg transition hover:bg-tint"
      >
        <ArrowLeftIcon />
      </Link>
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-lg font-semibold tracking-tight text-shadow-soft">
          {subject ? subject.name : subjectId === null ? 'No subject' : 'Study'}
        </h1>
        <p className="text-xs text-fg-subtle tabular-nums" aria-live="polite">
          {card
            ? `${plural(left.total, 'card')} left today`
            : `${plural(history.length, 'answer')} given`}
        </p>
      </div>
      {history.length > 0 && (
        <button
          type="button"
          onClick={() => void undo()}
          disabled={busy}
          title="Undo (Z)"
          className="inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-sm font-medium text-fg-muted transition hover:bg-tint hover:text-fg"
        >
          <UndoIcon /> Undo
        </button>
      )}
    </div>
  )

  if (!card) {
    const next = nextDue(all, { now, subjectId })
    return (
      <div className="mx-auto w-full max-w-2xl">
        {header}
        <div className="rounded-[28px] glass p-6 text-center sm:p-8">
          <p className="font-serif text-4xl tracking-tight">
            {history.length ? 'Done for now' : 'Nothing to study now'}
          </p>
          {history.length > 0 && (
            <p className="mt-3 text-sm text-fg-muted">
              {plural(history.length, 'answer')}, {remembered} remembered.
            </p>
          )}
          <p className="mt-2 text-sm text-fg-subtle">
            {next
              ? `The next card is due ${describeWhen(next, now)}.`
              : 'No cards are waiting.'}
          </p>
          <Link
            href={paths.cards}
            className="mt-6 inline-flex rounded-full bg-tint px-4 py-2 text-sm font-semibold transition hover:bg-line"
          >
            Back to cards
          </Link>
        </div>
      </div>
    )
  }

  const cardSubject = findSubject(card.subjectId)
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col">
      {header}
      <article
        aria-label="Card"
        className="flex min-h-[45dvh] flex-col rounded-[28px] glass-strong p-5 sm:p-8"
      >
        <div className="mb-5 flex min-w-0 items-center gap-3 text-xs text-fg-subtle">
          {cardSubject && (
            <span className="inline-flex shrink-0 items-center gap-1.5">
              <SubjectDot color={cardSubject.color} />
              {cardSubject.name}
            </span>
          )}
          <SourceLink card={card} />
          <span className="ml-auto shrink-0 capitalize">
            {card.schedule.state === 'review' ? '' : card.schedule.state}
          </span>
        </div>
        <div className="text-lg sm:text-xl">
          <MarkdownView markdown={card.front} />
        </div>
        {revealed && (
          <div className="mt-6 border-t border-line pt-6 text-[17px]">
            <MarkdownView markdown={card.back} />
          </div>
        )}
      </article>

      <div className="sticky bottom-[calc(env(safe-area-inset-bottom)+5.5rem)] mt-4 lg:bottom-4">
        {revealed && shown?.outcomes ? (
          <div
            role="group"
            aria-label="How well did you remember it?"
            className="grid grid-cols-4 gap-2 rounded-[28px] glass-strong p-2"
          >
            {RATINGS.map(({ rating, label, tone }) => (
              <button
                key={rating}
                type="button"
                disabled={busy}
                onClick={() => rate(rating)}
                className="flex flex-col items-center rounded-[20px] px-1 py-2.5 transition hover:bg-tint active:scale-[0.98] disabled:opacity-50"
              >
                <span className={cn('text-sm font-semibold', tone)}>
                  {label}
                </span>
                <span className="text-xs text-fg-subtle tabular-nums">
                  {describeInterval(
                    Date.parse(shown.outcomes![rating].due) - shown.at,
                  )}
                </span>
                <span className="mt-0.5 hidden text-[10px] text-fg-subtle/70 sm:block">
                  {rating}
                </span>
              </button>
            ))}
          </div>
        ) : (
          <button
            type="button"
            onClick={reveal}
            className="w-full rounded-[28px] bg-linear-to-br from-amber-300 to-orange-500 px-6 py-4 text-base font-semibold text-orange-950 shadow-[0_10px_24px_-12px_rgb(249_115_22/0.8)] transition active:scale-[0.99] disabled:opacity-50"
          >
            Show answer
            <span className="ml-2 hidden text-xs font-medium opacity-70 sm:inline">
              Space
            </span>
          </button>
        )}
      </div>
    </div>
  )
}
