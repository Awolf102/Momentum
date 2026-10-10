import { useDeferredValue, useMemo, useState } from 'react'
import { Link } from 'wouter'
import {
  CardsIcon,
  PlusIcon,
  SearchIcon,
  SparkleIcon,
} from '@/components/icons'
import { SegmentedControl } from '@/components/SegmentedControl'
import { SettingsCard } from '@/components/SettingsCard'
import { Switch } from '@/components/Switch'
import { addHabit, habitsStore } from '@/features/habits'
import { plainLines } from '@/features/notes'
import {
  liveSubjects,
  SubjectDot,
  subjectsStore,
  type Subject,
} from '@/features/subjects'
import { cn } from '@/lib/cn'
import { paths } from '@/lib/routes'
import { useStore } from '@/lib/store'
import { useCards, useDue } from '../hooks/useCards'
import { describeWhen } from '../lib/format'
import { dueCounts } from '../lib/queue'
import { linkedHabit } from '../review'
import {
  cardSettingsStore,
  NEW_PER_DAY_CHOICES,
  RETENTION_CHOICES,
  updateCardSettings,
} from '../settings'
import type { FlashCard } from '../types'
import { editCardStore, newCardWith } from '../editing'

const plural = (count: number, one: string, many = `${one}s`) =>
  `${count} ${count === 1 ? one : many}`

const primary =
  'inline-flex items-center gap-1.5 rounded-full bg-linear-to-br from-amber-300 to-orange-500 px-4 py-2 text-sm font-semibold text-orange-950 shadow-[0_10px_24px_-12px_rgb(249_115_22/0.8)] transition active:scale-[0.98]'
const secondary =
  'inline-flex items-center gap-1.5 rounded-full bg-tint px-4 py-2 text-sm font-semibold transition hover:bg-line'

/** One line of a card's front, as plain text. */
const firstLine = (card: FlashCard) =>
  plainLines(card.front)[0] ?? card.front.trim()

/** The Cards page: today's study, the cards by subject, and options. */
export function CardsHome() {
  const all = useCards()
  if (all.length === 0) return <EmptyCards />
  return (
    <div className="space-y-5">
      <Today />
      <BySubject cards={all} />
      <Browse cards={all} />
      <Options />
    </div>
  )
}

function EmptyCards() {
  return (
    <div className="rounded-[28px] glass p-6 sm:p-8">
      <span className="flex size-12 items-center justify-center rounded-2xl bg-linear-to-br from-amber-300/25 to-orange-500/25 text-2xl text-orange-300 ring-1 ring-orange-300/30 light:text-orange-500">
        <CardsIcon />
      </span>
      <h2 className="mt-4 text-xl font-semibold tracking-tight">
        Remember what you study
      </h2>
      <p className="mt-2 max-w-prose text-sm leading-relaxed text-fg-muted">
        A card is a question and its answer. Each comes back just before you’d
        forget it (FSRS works out when), so a few minutes a day keep it all
        fresh. Write cards here, put them in a note as{' '}
        <code className="rounded bg-tint px-1">question :: answer</code> lines,
        or have AI suggest some from a note or a PDF.
      </p>
      <div className="mt-5 flex flex-wrap gap-2">
        <button type="button" onClick={() => newCardWith()} className={primary}>
          <PlusIcon /> Write a card
        </button>
        <Link href={paths.makeCards()} className={secondary}>
          <SparkleIcon /> Make cards from a note or PDF
        </Link>
      </div>
    </div>
  )
}

function Today() {
  const { counts, next, now } = useDue()
  const parts = [
    counts.learning && `${counts.learning} being learnt`,
    counts.review && plural(counts.review, 'review'),
    counts.new && `${counts.new} new`,
  ].filter(Boolean)
  return (
    <div className="flex flex-wrap items-center gap-4 rounded-[28px] glass p-5 sm:p-6">
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-semibold tracking-[0.18em] text-fg-subtle uppercase">
          Today
        </p>
        <p className="mt-1 font-serif text-4xl tracking-tight tabular-nums">
          {counts.total ? plural(counts.total, 'card') : 'All done'}
        </p>
        <p className="mt-1 text-sm text-fg-muted">
          {counts.total
            ? parts.join(' · ')
            : next
              ? `The next card is due ${describeWhen(next, now)}.`
              : 'Nothing is waiting.'}
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {counts.total > 0 && (
          <Link href={paths.study()} className={primary}>
            Study now
          </Link>
        )}
        <button
          type="button"
          onClick={() => newCardWith()}
          className={secondary}
        >
          <PlusIcon /> New card
        </button>
        <Link href={paths.makeCards()} className={secondary}>
          <SparkleIcon /> Make cards
        </Link>
      </div>
    </div>
  )
}

function BySubject({ cards }: { cards: readonly FlashCard[] }) {
  const subjects = liveSubjects(useStore(subjectsStore))
  const { newPerDay } = useStore(cardSettingsStore)
  const { now } = useDue()
  const groups = useMemo(() => {
    const list: Array<{ subject: Subject | null; id: string | null }> = [
      ...subjects.map((subject) => ({ subject, id: subject.id })),
      { subject: null, id: null },
    ]
    return list
      .map(({ subject, id }) => ({
        subject,
        id,
        total: cards.filter((card) => card.subjectId === id).length,
        due: dueCounts(cards, { now, newPerDay, subjectId: id }).total,
      }))
      .filter((group) => group.total > 0)
  }, [subjects, cards, now, newPerDay])
  if (groups.length < 2) return null
  return (
    <SettingsCard title="By subject">
      <ul className="space-y-1.5">
        {groups.map(({ subject, id, total, due }) => (
          <li
            key={id ?? 'none'}
            className="flex items-center gap-3 rounded-2xl bg-tint px-4 py-3"
          >
            {subject ? (
              <SubjectDot color={subject.color} />
            ) : (
              <span className="size-2.5 rounded-full bg-line" />
            )}
            <span className="min-w-0 flex-1 truncate text-sm font-medium">
              {subject?.name ?? 'No subject'}
            </span>
            <span className="text-xs text-fg-subtle tabular-nums">
              {plural(total, 'card')}
              {due ? ` · ${due} due` : ''}
            </span>
            {due > 0 && (
              <Link
                href={paths.study(id)}
                className="rounded-full px-3 py-1 text-xs font-semibold text-orange-300 transition hover:bg-line light:text-orange-600"
              >
                Study
              </Link>
            )}
          </li>
        ))}
      </ul>
    </SettingsCard>
  )
}

const SHOWN = 50

function Browse({ cards }: { cards: readonly FlashCard[] }) {
  const subjects = liveSubjects(useStore(subjectsStore))
  const { now } = useDue()
  const [query, setQuery] = useState('')
  const deferred = useDeferredValue(query.trim().toLowerCase())
  const [more, setMore] = useState(false)
  const found = useMemo(
    () =>
      [...cards]
        .filter(
          (card) =>
            !deferred ||
            card.front.toLowerCase().includes(deferred) ||
            card.back.toLowerCase().includes(deferred),
        )
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [cards, deferred],
  )
  const shown = more ? found : found.slice(0, SHOWN)
  return (
    <SettingsCard
      title={`All cards (${cards.length})`}
      aside={
        <label className="relative flex items-center">
          <SearchIcon className="pointer-events-none absolute left-3 text-fg-subtle" />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Find a card"
            aria-label="Find a card"
            className="w-36 rounded-full bg-tint py-1.5 pr-3 pl-8 text-sm outline-none placeholder:text-fg-subtle focus-visible:ring-2 focus-visible:ring-orange-300/60 sm:w-48"
          />
        </label>
      }
    >
      {shown.length === 0 ? (
        <p className="text-sm text-fg-subtle">No card has those words.</p>
      ) : (
        <ul className="divide-y divide-line">
          {shown.map((card) => {
            const subject = subjects.find((each) => each.id === card.subjectId)
            return (
              <li key={card.id}>
                <button
                  type="button"
                  onClick={() => editCardStore.set(card.id)}
                  className="flex w-full items-center gap-3 py-2.5 text-left transition hover:text-fg"
                >
                  {subject ? (
                    <SubjectDot color={subject.color} />
                  ) : (
                    <span className="size-2.5 shrink-0 rounded-full bg-line" />
                  )}
                  <span className="min-w-0 flex-1 truncate text-sm">
                    {firstLine(card)}
                  </span>
                  <span
                    className={cn(
                      'shrink-0 text-xs tabular-nums',
                      card.schedule.state === 'new'
                        ? 'text-orange-300 light:text-orange-600'
                        : 'text-fg-subtle',
                    )}
                  >
                    {card.schedule.state === 'new'
                      ? 'New'
                      : `Due ${describeWhen(new Date(card.schedule.due), now)}`}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
      {!more && found.length > SHOWN && (
        <button
          type="button"
          onClick={() => setMore(true)}
          className="mt-3 text-sm font-semibold text-fg-muted hover:text-fg"
        >
          Show all {found.length}
        </button>
      )}
    </SettingsCard>
  )
}

function Options() {
  const settings = useStore(cardSettingsStore)
  // The linked habit, as habits change (it may be renamed or deleted).
  useStore(habitsStore)
  const habit = linkedHabit()
  return (
    <SettingsCard
      title="Options"
      description="How many new cards a day, and how well reviews aim for you to remember."
    >
      <div className="space-y-5">
        <div className="space-y-2">
          <p className="text-sm font-medium">New cards a day</p>
          <SegmentedControl
            label="New cards a day"
            value={String(settings.newPerDay)}
            options={NEW_PER_DAY_CHOICES.map((count) => ({
              value: String(count),
              label: String(count),
            }))}
            onChange={(value) =>
              updateCardSettings({ newPerDay: Number(value) })
            }
            compact
          />
        </div>
        <div className="space-y-2">
          <p className="text-sm font-medium">Aim to remember</p>
          <SegmentedControl
            label="Aim to remember"
            value={String(settings.retention)}
            options={RETENTION_CHOICES.map((value) => ({
              value: String(value),
              label: `${Math.round(value * 100)}%`,
            }))}
            onChange={(value) =>
              updateCardSettings({ retention: Number(value) })
            }
            compact
          />
          <p className="text-xs text-fg-subtle">
            Higher means more reviews, sooner. 90% suits most people.
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">Count cards as a habit</p>
            <p className="text-xs text-fg-subtle">
              {habit
                ? `“${habit.name}” is done for the day once the day’s cards are.`
                : 'A habit that’s done for the day once the day’s cards are.'}
            </p>
          </div>
          <Switch
            label="Count cards as a habit"
            checked={Boolean(habit)}
            onChange={(on) =>
              updateCardSettings({
                habitId: on ? (addHabit('Study cards')?.id ?? null) : null,
              })
            }
          />
        </div>
      </div>
    </SettingsCard>
  )
}
