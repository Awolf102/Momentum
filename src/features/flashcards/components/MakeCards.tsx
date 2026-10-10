import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'wouter'
import {
  LibraryIcon,
  NoteIcon,
  SearchIcon,
  SparkleIcon,
} from '@/components/icons'
import { SegmentedControl } from '@/components/SegmentedControl'
import { SettingsCard } from '@/components/SettingsCard'
import { describeAiError, SendPreview, useAiReadiness } from '@/features/ai'
import {
  estimateTokens,
  fitSource,
  type SourceText,
} from '@/features/ai/material'
import {
  documents,
  loadDocumentTexts,
  type LibraryDocument,
} from '@/features/library'
import { notes, type Note } from '@/features/notes'
import { SubjectPicker } from '@/features/subjects'
import { cn } from '@/lib/cn'
import { createId } from '@/lib/id'
import { navigate, openSettings, paths } from '@/lib/routes'
import { useStore } from '@/lib/store'
import { toast } from '@/lib/toast'
import { addCards, findSimilar } from '../actions'
import { suggestCards } from '../generate'
import { cardsInNote } from '../lib/text'
import type { CardSource } from '../types'

const plural = (count: number, one: string, many = `${one}s`) =>
  `${count} ${count === 1 ? one : many}`

interface Draft {
  key: string
  front: string
  back: string
  page: number | null
  keep: boolean
  /** Already a card from this source. */
  existing: boolean
  /** Where it came from: written in the note, or suggested. */
  origin: 'note' | 'ai'
}

/** Making cards from a note or a PDF: chosen, or given by the address. */
export function MakeCards({
  noteId,
  documentId,
  page,
}: {
  noteId: string | null
  documentId: string | null
  page: number | null
}) {
  const note = useStore(notes).find((each) => each.id === noteId)
  const document = useStore(documents).find((each) => each.id === documentId)
  if (!note && !document) return <SourcePicker />
  return note ? (
    <FromSource key={`note:${note.id}`} note={note} />
  ) : (
    <FromSource
      key={`document:${document!.id}:${page}`}
      document={document!}
      page={page}
    />
  )
}

function SourcePicker() {
  const allNotes = useStore(notes)
  const library = useStore(documents)
  const [query, setQuery] = useState('')
  const words = query.trim().toLowerCase()
  const items = useMemo(
    () =>
      [
        ...allNotes.map((note) => ({
          key: `note:${note.id}`,
          title: note.title || 'Untitled',
          updatedAt: note.updatedAt,
          href: paths.makeCards({ note: note.id }),
          icon: <NoteIcon />,
        })),
        ...library.map((document) => ({
          key: `document:${document.id}`,
          title: document.title,
          updatedAt: document.updatedAt,
          href: paths.makeCards({ document: document.id }),
          icon: <LibraryIcon />,
        })),
      ]
        .filter((item) => !words || item.title.toLowerCase().includes(words))
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    [allNotes, library, words],
  )
  return (
    <SettingsCard
      title="From a note or a PDF"
      description="Choose one: you’ll see the cards written in it, and can have AI suggest more."
      aside={
        <label className="relative flex items-center">
          <SearchIcon className="pointer-events-none absolute left-3 text-fg-subtle" />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Find"
            aria-label="Find a note or PDF"
            className="w-32 rounded-full bg-tint py-1.5 pr-3 pl-8 text-sm outline-none placeholder:text-fg-subtle focus-visible:ring-2 focus-visible:ring-orange-300/60 sm:w-44"
          />
        </label>
      }
    >
      {items.length === 0 ? (
        <p className="text-sm text-fg-subtle">
          {words ? 'Nothing has that title.' : 'No notes or PDFs yet.'}
        </p>
      ) : (
        <ul className="divide-y divide-line">
          {items.slice(0, 40).map((item) => (
            <li key={item.key}>
              <Link
                href={item.href}
                className="flex items-center gap-3 py-2.5 text-sm transition hover:text-fg"
              >
                <span className="text-fg-subtle">{item.icon}</span>
                <span className="min-w-0 flex-1 truncate">{item.title}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </SettingsCard>
  )
}

const COUNTS = [5, 10, 20] as const

function FromSource({
  note,
  document,
  page = null,
}: {
  note?: Note
  document?: LibraryDocument
  page?: number | null
}) {
  const kind = note ? 'note' : 'document'
  const id = note?.id ?? document!.id
  const title = note ? note.title || 'Untitled' : document!.title
  const sourceFor = (atPage: number | null): CardSource => ({
    kind,
    id,
    page: kind === 'document' ? atPage : null,
  })

  // A document's text, one string a page.
  const [pages, setPages] = useState<readonly string[] | null>(null)
  useEffect(() => {
    if (!document) return
    let current = true
    void loadDocumentTexts().then((texts) => {
      if (current) setPages(texts.get(document.id) ?? [])
    })
    return () => {
      current = false
    }
  }, [document])
  const [scope, setScope] = useState<'page' | 'all'>(page ? 'page' : 'all')

  const [drafts, setDrafts] = useState<Draft[]>(() =>
    note
      ? cardsInNote(note.body).map((draft) => {
          const existing = Boolean(findSimilar(draft.front, sourceFor(null)))
          return {
            key: createId(),
            front: draft.front,
            back: draft.back,
            page: null,
            keep: !existing,
            existing,
            origin: 'note' as const,
          }
        })
      : [],
  )
  const [subjectId, setSubjectId] = useState<string | null>(
    note?.subjectId ?? document?.subjectId ?? null,
  )

  // What AI would be sent.
  const text: SourceText | null = note
    ? { kind, title, parts: [{ page: null, text: note.body }] }
    : pages
      ? {
          kind,
          title,
          parts: pages
            .map((each, index) => ({ page: index + 1, text: each }))
            .filter((part) => scope === 'all' || part.page === page),
        }
      : null
  const fitted = text ? fitSource(text) : null
  const sentPages = fitted?.source.parts.filter((part) => part.text).length ?? 0
  const readiness = useAiReadiness('chat')
  const [count, setCount] = useState<(typeof COUNTS)[number]>(10)
  const [previewing, setPreviewing] = useState(false)
  const [asking, setAsking] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const controller = useRef<AbortController | null>(null)
  useEffect(() => () => controller.current?.abort(), [])

  async function suggest() {
    if (!fitted) return
    setPreviewing(false)
    setAsking(true)
    setProblem(null)
    controller.current = new AbortController()
    try {
      const suggested = await suggestCards(fitted.source, {
        count,
        signal: controller.current.signal,
      })
      if (suggested.length === 0) {
        setProblem('No cards came back. Try again, or with more of the text.')
        return
      }
      setDrafts((list) => {
        const fronts = new Set(list.map((draft) => draft.front.toLowerCase()))
        const added: Draft[] = []
        for (const card of suggested) {
          if (fronts.has(card.front.toLowerCase())) continue
          fronts.add(card.front.toLowerCase())
          const atPage =
            kind === 'document'
              ? (card.page ?? (scope === 'page' ? page : null))
              : null
          const existing = Boolean(findSimilar(card.front, sourceFor(atPage)))
          added.push({
            key: createId(),
            front: card.front,
            back: card.back,
            page: atPage,
            keep: !existing,
            existing,
            origin: 'ai',
          })
        }
        return [...list, ...added]
      })
    } catch (error) {
      if (!controller.current?.signal.aborted)
        setProblem(describeAiError(error))
    } finally {
      setAsking(false)
    }
  }

  function change(key: string, changes: Partial<Draft>) {
    setDrafts((list) =>
      list.map((draft) =>
        draft.key === key ? { ...draft, ...changes } : draft,
      ),
    )
  }

  const chosen = drafts.filter(
    (draft) => draft.keep && draft.front.trim() && draft.back.trim(),
  )

  async function save() {
    if (chosen.length === 0) return
    await addCards(
      chosen.map((draft) => ({
        front: draft.front,
        back: draft.back,
        source: sourceFor(draft.page),
      })),
      { subjectId },
    )
    toast({
      title: `${plural(chosen.length, 'card')} added`,
      action: { label: 'Study', run: () => navigate(paths.study()) },
    })
    navigate(paths.cards)
  }

  const fromNote = drafts.filter((draft) => draft.origin === 'note').length
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3 rounded-[28px] glass p-4 pr-5">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-tint text-lg text-fg-muted">
          {note ? <NoteIcon /> : <LibraryIcon />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-medium">{title}</p>
          <p className="text-xs text-fg-subtle">
            {note
              ? fromNote
                ? `${plural(fromNote, 'card')} written in it as “question :: answer”`
                : 'No “question :: answer” lines in it yet'
              : pages
                ? plural(pages.length, 'page')
                : 'Reading…'}
          </p>
        </div>
        <Link
          href={paths.makeCards()}
          className="rounded-full px-3 py-1.5 text-sm font-medium text-fg-muted transition hover:bg-tint hover:text-fg"
        >
          Change
        </Link>
      </div>

      <SettingsCard
        title="Suggest cards with AI"
        description="AI reads the text and suggests cards; you choose which to keep."
      >
        {readiness.ready ? (
          <div className="space-y-4">
            {document && page && (
              <div className="w-full sm:w-80">
                <SegmentedControl
                  label="Which pages"
                  value={scope}
                  options={[
                    { value: 'page', label: `Page ${page}` },
                    { value: 'all', label: 'The whole PDF' },
                  ]}
                  onChange={setScope}
                />
              </div>
            )}
            <div className="flex flex-wrap items-center gap-3">
              <div className="w-48">
                <SegmentedControl
                  label="How many cards"
                  value={String(count)}
                  options={COUNTS.map((each) => ({
                    value: String(each),
                    label: `${each}`,
                  }))}
                  onChange={(value) =>
                    setCount(Number(value) as (typeof COUNTS)[number])
                  }
                  compact
                />
              </div>
              <button
                type="button"
                disabled={!fitted || fitted.characters === 0 || asking}
                onClick={() => setPreviewing(true)}
                className="inline-flex items-center gap-1.5 rounded-full bg-linear-to-br from-amber-300 to-orange-500 px-4 py-2 text-sm font-semibold text-orange-950 disabled:opacity-40"
              >
                <SparkleIcon />
                {asking ? 'Suggesting…' : 'Suggest cards…'}
              </button>
              {asking && (
                <button
                  type="button"
                  onClick={() => controller.current?.abort()}
                  className="text-sm font-medium text-fg-muted hover:text-fg"
                >
                  Stop
                </button>
              )}
            </div>
            {fitted && fitted.characters === 0 && (
              <p className="text-xs text-fg-subtle">
                There’s no text to send{document ? ' (a scanned PDF?)' : ''}.
              </p>
            )}
            {problem && (
              <p className="text-sm text-rose-300 light:text-rose-600">
                {problem}
              </p>
            )}
          </div>
        ) : (
          <p className="text-sm text-fg-muted">
            Set up a chat model to have AI suggest cards.{' '}
            <button
              type="button"
              onClick={() => openSettings('ai')}
              className="font-semibold text-fg underline-offset-2 hover:underline"
            >
              Settings → AI
            </button>
          </p>
        )}
      </SettingsCard>

      {drafts.length > 0 && (
        <SettingsCard
          title={`Cards to add (${chosen.length} of ${drafts.length})`}
          description="Untick any you don’t want; edit any that could be clearer."
        >
          <ul className="space-y-2">
            {drafts.map((draft) => (
              <li
                key={draft.key}
                className={cn(
                  'flex gap-3 rounded-2xl bg-tint p-3',
                  !draft.keep && 'opacity-60',
                )}
              >
                <input
                  type="checkbox"
                  checked={draft.keep}
                  onChange={(event) =>
                    change(draft.key, { keep: event.target.checked })
                  }
                  aria-label={`Add “${draft.front}”`}
                  className="mt-2 size-4 shrink-0 accent-orange-400"
                />
                <div className="min-w-0 flex-1 space-y-1.5">
                  <textarea
                    value={draft.front}
                    onChange={(event) =>
                      change(draft.key, { front: event.target.value })
                    }
                    rows={1}
                    aria-label="Front"
                    className="block w-full resize-y rounded-lg bg-transparent px-1 py-1 text-sm font-medium outline-none focus-visible:bg-line"
                  />
                  <textarea
                    value={draft.back}
                    onChange={(event) =>
                      change(draft.key, { back: event.target.value })
                    }
                    rows={2}
                    aria-label="Back"
                    className="block w-full resize-y rounded-lg bg-transparent px-1 py-1 text-sm text-fg-muted outline-none focus-visible:bg-line"
                  />
                  <p className="px-1 text-[11px] text-fg-subtle">
                    {draft.origin === 'note'
                      ? 'Written in the note'
                      : 'Suggested'}
                    {draft.page ? ` · page ${draft.page}` : ''}
                    {draft.existing ? ' · already a card' : ''}
                  </p>
                </div>
              </li>
            ))}
          </ul>
          <div className="mt-5 space-y-3">
            <p className="text-xs font-semibold tracking-[0.14em] text-fg-subtle uppercase">
              Subject
            </p>
            <SubjectPicker value={subjectId} onChange={setSubjectId} />
            <button
              type="button"
              disabled={chosen.length === 0}
              onClick={() => void save()}
              className="rounded-full bg-linear-to-br from-amber-300 to-orange-500 px-5 py-2.5 text-sm font-semibold text-orange-950 disabled:opacity-40"
            >
              Add {plural(chosen.length, 'card')}
            </button>
          </div>
        </SettingsCard>
      )}

      {readiness.ready && fitted && (
        <SendPreview
          open={previewing}
          onClose={() => setPreviewing(false)}
          title="Suggest cards"
          purpose={
            <>
              To suggest up to {count} cards, the text below is sent with
              instructions to write flashcards from it.
              {fitted.cut &&
                ' It’s long, so only the first part is sent; choose a page to send another part.'}
            </>
          }
          provider={readiness.provider}
          model={readiness.model}
          items={[
            {
              id,
              title,
              detail: note
                ? 'The whole note'
                : sentPages === 1
                  ? `Page ${fitted.source.parts[0].page}`
                  : plural(sentPages, 'page'),
              icon: note ? <NoteIcon /> : <LibraryIcon />,
            },
          ]}
          tokens={estimateTokens(fitted.characters)}
          sendLabel="Send"
          onSend={() => void suggest()}
        />
      )}
    </div>
  )
}
