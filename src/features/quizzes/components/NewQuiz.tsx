import { useEffect, useMemo, useRef, useState } from 'react'
import {
  LibraryIcon,
  NoteIcon,
  SearchIcon,
  SparkleIcon,
} from '@/components/icons'
import { SegmentedControl } from '@/components/SegmentedControl'
import { SettingsCard } from '@/components/SettingsCard'
import {
  describeAiError,
  formatTokenEstimate,
  isAiError,
  ReplyStatus,
  SendPreview,
  startReply,
  useAiReadiness,
  type ReplyProgress,
} from '@/features/ai'
import {
  estimateTokens,
  spreadSources,
  type SourceText,
} from '@/features/ai/material'
import {
  documents,
  documentTexts,
  loadDocumentTexts,
  onDocumentTextsChange,
} from '@/features/library'
import { notes } from '@/features/notes'
import { SubjectPicker } from '@/features/subjects'
import { cn } from '@/lib/cn'
import { navigate, openSettings, paths } from '@/lib/routes'
import { useStore } from '@/lib/store'
import { toast } from '@/lib/toast'
import { useMediaQuery } from '@/lib/useMediaQuery'
import { createQuiz, quizTitle } from '../actions'
import { writeQuestions, type QuizMix } from '../generate'
import { describeSent, parsePages } from '../lib/pages'
import type { SentSource } from '../lib/questions'
import type { QuizSource } from '../types'
import { plural, primary } from './ui'

const COUNTS = [5, 10, 20] as const
const MIXES: ReadonlyArray<{ value: QuizMix; label: string; short?: string }> =
  [
    { value: 'mixed', label: 'Mixed' },
    // "Multiple choice" doesn't fit a third of a phone's width.
    { value: 'choice', label: 'Multiple choice', short: 'Multi-choice' },
    { value: 'short', label: 'Short answer' },
  ]
/** Notes and PDFs listed to choose from (the chosen ones always are). */
const LISTED = 40

/** Every document's text, page by page, kept up to date as PDFs are read. */
function useDocumentTexts(): ReadonlyMap<string, readonly string[]> | null {
  const [texts, setTexts] = useState<ReadonlyMap<
    string,
    readonly string[]
  > | null>(null)
  useEffect(() => {
    let current = true
    void loadDocumentTexts().then((loaded) => {
      if (current) setTexts(new Map(loaded))
    })
    const stop = onDocumentTextsChange(() => {
      if (current) setTexts(new Map(documentTexts()))
    })
    return () => {
      current = false
      stop()
    }
  }, [])
  return texts
}

/** A note or PDF that's been chosen, and its text as chosen. */
interface Picked {
  key: string
  kind: 'note' | 'document'
  id: string
  title: string
  subjectId: string | null
  /** Null while a document's text loads, or when there's none. */
  text: SourceText | null
  /** A document's pages. */
  total: number | null
  /** Why it can't go as it is. */
  issue: Issue | null
}

/** Pages written that can't be read; a PDF without text; an empty note. */
type Issue = 'pages' | 'no-text' | 'empty'

function describeIssue(issue: Issue, total: number | null): string {
  if (issue === 'pages')
    return `Write pages like 3–7, 10${total ? ` (it has ${total})` : ''}`
  if (issue === 'no-text')
    return 'There’s no text in it to send (a scanned PDF?)'
  return 'Nothing written in it yet'
}

/** Making a quiz: the notes and PDFs it's from, how many questions, and of what kind. */
export function NewQuiz({
  noteId,
  documentId,
}: {
  noteId: string | null
  documentId: string | null
}) {
  const allNotes = useStore(notes)
  const library = useStore(documents)
  const texts = useDocumentTexts()
  const readiness = useAiReadiness('chat')
  const wide = useMediaQuery('(min-width: 640px)')

  const [chosen, setChosen] = useState<string[]>(() =>
    noteId ? [`note:${noteId}`] : documentId ? [`document:${documentId}`] : [],
  )
  const [pagesWritten, setPagesWritten] = useState<Record<string, string>>({})
  const [query, setQuery] = useState('')
  const [count, setCount] = useState<(typeof COUNTS)[number]>(10)
  const [mix, setMix] = useState<QuizMix>('mixed')
  // Undefined until chosen: then it follows the first note or PDF's.
  const [subjectChoice, setSubjectChoice] = useState<string | null>()
  const [previewing, setPreviewing] = useState(false)
  const [writing, setWriting] = useState(false)
  const [progress, setProgress] = useState<ReplyProgress>({ since: 0 })
  const [problem, setProblem] = useState<string | null>(null)
  const controller = useRef<AbortController | null>(null)
  useEffect(() => () => controller.current?.abort(), [])

  const picked = chosen
    .map((key): Picked | null => {
      const id = key.slice(key.indexOf(':') + 1)
      if (key.startsWith('note:')) {
        const note = allNotes.find((each) => each.id === id)
        if (!note) return null
        const title = note.title || 'Untitled'
        return {
          key,
          kind: 'note',
          id,
          title,
          subjectId: note.subjectId,
          text: {
            kind: 'note',
            title,
            parts: [{ page: null, text: note.body }],
          },
          total: null,
          issue: note.body.trim() ? null : 'empty',
        }
      }
      const document = library.find((each) => each.id === id)
      if (!document) return null
      const base = {
        key,
        kind: 'document' as const,
        id,
        title: document.title,
        subjectId: document.subjectId,
        total: document.pages,
      }
      if (!texts) return { ...base, text: null, issue: null }
      const pages = texts.get(id) ?? []
      if (!pages.some((page) => page.trim()))
        return { ...base, text: null, issue: 'no-text' }
      const wanted = parsePages(pagesWritten[key] ?? '', pages.length)
      if (!wanted)
        return { ...base, total: pages.length, text: null, issue: 'pages' }
      return {
        ...base,
        total: pages.length,
        text: {
          kind: 'document',
          title: document.title,
          parts: wanted.map((page) => ({ page, text: pages[page - 1] ?? '' })),
        },
        issue: null,
      }
    })
    .filter((each): each is Picked => each !== null)

  const ready = picked.filter((each) => each.text && !each.issue)
  const fitted = spreadSources(ready.map((each) => each.text!))
  const going = ready
    .map((each, index) => ({ ...each, sent: fitted.sources[index] }))
    .filter((each) => each.sent.parts.length > 0)
  const blocked = picked.some((each) => each.issue === 'pages')
  const subjectId =
    subjectChoice !== undefined ? subjectChoice : (picked[0]?.subjectId ?? null)

  function toggle(key: string, on: boolean) {
    setChosen((list) =>
      on
        ? [...list.filter((each) => each !== key), key]
        : list.filter((each) => each !== key),
    )
  }

  async function make() {
    setPreviewing(false)
    if (going.length === 0) return
    setWriting(true)
    setProgress(startReply())
    setProblem(null)
    controller.current = new AbortController()
    const sent: SentSource[] = going.map((each) => ({
      kind: each.kind,
      id: each.id,
      pages:
        each.kind === 'document'
          ? each.sent.parts.map((part) => part.page!)
          : null,
    }))
    try {
      const { questions, cutOff } = await writeQuestions(
        going.map((each) => each.sent),
        sent,
        {
          count,
          mix,
          signal: controller.current.signal,
          onProgress: (phase) =>
            setProgress((current) => ({ ...current, phase })),
        },
      )
      if (questions.length === 0) {
        setProblem(
          cutOff
            ? 'The reply was cut off at the length limit before a whole question came through. Try fewer questions, or a longer limit in Settings → AI.'
            : 'No questions came back. Try again, or with more of the text.',
        )
        return
      }
      const sources: QuizSource[] = going.map((each, index) => ({
        ...sent[index],
        pages: sent[index].pages ? [...sent[index].pages] : null,
        title: each.title,
      }))
      const quiz = await createQuiz({
        title: quizTitle(sources),
        subjectId,
        sources,
        questions,
      })
      if (questions.length < count)
        toast({
          title: `${plural(questions.length, 'question')} came back`,
          description: cutOff
            ? 'The reply was cut off at the length limit.'
            : undefined,
        })
      navigate(paths.quiz(quiz.id), { replace: true })
    } catch (error) {
      if (!controller.current?.signal.aborted)
        setProblem(
          isAiError(error)
            ? describeAiError(error)
            : 'Something went wrong. Try again in a moment.',
        )
    } finally {
      setWriting(false)
    }
  }

  return (
    <div className="space-y-5">
      <MaterialPicker
        chosen={chosen}
        picked={picked}
        query={query}
        onQuery={setQuery}
        onToggle={toggle}
        pagesWritten={pagesWritten}
        onPages={(key, value) =>
          setPagesWritten((written) => ({ ...written, [key]: value }))
        }
      />

      <SettingsCard
        title="Questions"
        description="AI writes them from what you chose; answers are marked as you go."
      >
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="w-40">
              <SegmentedControl
                label="How many questions"
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
            <div className="w-full sm:w-96">
              <SegmentedControl
                label="Kind of question"
                value={mix}
                options={MIXES.map(({ value, label, short }) => ({
                  value,
                  label: wide ? label : (short ?? label),
                }))}
                onChange={setMix}
                compact
              />
            </div>
          </div>
          <div className="space-y-2">
            <p className="text-xs font-semibold tracking-[0.14em] text-fg-subtle uppercase">
              Subject
            </p>
            <SubjectPicker
              value={subjectId}
              onChange={(id) =>
                // Tapping the chosen subject again clears it.
                setSubjectChoice(id === subjectId ? null : id)
              }
            />
          </div>
          {readiness.ready ? (
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                disabled={going.length === 0 || blocked || writing}
                onClick={() => setPreviewing(true)}
                className={primary}
              >
                <SparkleIcon />
                {writing ? 'Writing questions…' : 'Make quiz…'}
              </button>
              {writing && (
                <button
                  type="button"
                  onClick={() => controller.current?.abort()}
                  className="text-sm font-medium text-fg-muted hover:text-fg"
                >
                  Stop
                </button>
              )}
              {writing && (
                <ReplyStatus since={progress.since} phase={progress.phase} />
              )}
              {!writing && going.length > 0 && (
                <p className="text-xs text-fg-subtle first-letter:uppercase">
                  {formatTokenEstimate(estimateTokens(fitted.characters))} of
                  text
                  {fitted.cut ? ', from all through what you chose' : ''}
                </p>
              )}
            </div>
          ) : (
            <p className="text-sm text-fg-muted">
              Set up a chat model to have AI write quizzes.{' '}
              <button
                type="button"
                onClick={() => openSettings('ai')}
                className="font-semibold text-fg underline-offset-2 hover:underline"
              >
                Settings → AI
              </button>
            </p>
          )}
          {problem && (
            <p className="text-sm text-rose-300 light:text-rose-600">
              {problem}
            </p>
          )}
        </div>
      </SettingsCard>

      {readiness.ready && going.length > 0 && (
        <SendPreview
          open={previewing}
          onClose={() => setPreviewing(false)}
          title="Make a quiz"
          purpose={
            <>
              To write {count} questions, the text below is sent with
              instructions to write a practice quiz from it.
              {fitted.cut &&
                ' It’s too long to send whole, so pages from all through it are sent.'}
            </>
          }
          provider={readiness.provider}
          model={readiness.model}
          items={ready.map((each, index) => ({
            id: each.key,
            title: each.title,
            detail: describeSent(each.text!, fitted.sources[index], each.total),
            icon: each.kind === 'note' ? <NoteIcon /> : <LibraryIcon />,
          }))}
          tokens={estimateTokens(fitted.characters)}
          sendLabel="Send"
          onSend={() => void make()}
        />
      )}
    </div>
  )
}

function MaterialPicker({
  chosen,
  picked,
  query,
  onQuery,
  onToggle,
  pagesWritten,
  onPages,
}: {
  chosen: readonly string[]
  picked: readonly Picked[]
  query: string
  onQuery: (query: string) => void
  onToggle: (key: string, on: boolean) => void
  pagesWritten: Readonly<Record<string, string>>
  onPages: (key: string, value: string) => void
}) {
  const allNotes = useStore(notes)
  const library = useStore(documents)
  const words = query.trim().toLowerCase()
  const items = useMemo(() => {
    const all = [
      ...allNotes.map((note) => ({
        key: `note:${note.id}`,
        title: note.title || 'Untitled',
        updatedAt: note.updatedAt,
        pages: null as number | null,
      })),
      ...library.map((document) => ({
        key: `document:${document.id}`,
        title: document.title,
        updatedAt: document.updatedAt,
        pages: document.pages,
      })),
    ].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    const isChosen = (key: string) => chosen.includes(key)
    return [
      ...all.filter((item) => isChosen(item.key)),
      ...all
        .filter(
          (item) =>
            !isChosen(item.key) &&
            (!words || item.title.toLowerCase().includes(words)),
        )
        .slice(0, LISTED),
    ]
  }, [allNotes, library, chosen, words])

  return (
    <SettingsCard
      title="From"
      description="Choose notes and PDFs; for a PDF you can choose pages."
      aside={
        <label className="relative flex items-center">
          <SearchIcon className="pointer-events-none absolute left-3 text-fg-subtle" />
          <input
            type="search"
            value={query}
            onChange={(event) => onQuery(event.target.value)}
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
          {items.map((item) => {
            const on = chosen.includes(item.key)
            const state = picked.find((each) => each.key === item.key)
            const isDocument = item.key.startsWith('document:')
            return (
              <li key={item.key} className="py-1">
                <label className="flex cursor-pointer items-center gap-3 py-1.5 text-sm">
                  <input
                    type="checkbox"
                    checked={on}
                    onChange={(event) =>
                      onToggle(item.key, event.target.checked)
                    }
                    className="size-4 shrink-0 accent-orange-400"
                  />
                  <span className="text-fg-subtle">
                    {isDocument ? <LibraryIcon /> : <NoteIcon />}
                  </span>
                  <span className="min-w-0 flex-1 truncate">{item.title}</span>
                  {item.pages && (
                    <span className="shrink-0 text-xs text-fg-subtle tabular-nums">
                      {plural(item.pages, 'page')}
                    </span>
                  )}
                </label>
                {on && (isDocument || state?.issue) && (
                  <div className="mb-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 pl-7">
                    {isDocument && state?.issue !== 'no-text' && (
                      <label className="flex items-center gap-2 text-xs text-fg-muted">
                        Pages
                        <input
                          value={pagesWritten[item.key] ?? ''}
                          onChange={(event) =>
                            onPages(item.key, event.target.value)
                          }
                          placeholder="All"
                          aria-label={`Pages of ${item.title}`}
                          aria-invalid={state?.issue === 'pages'}
                          className={cn(
                            'w-28 rounded-lg bg-tint px-2.5 py-1 text-sm text-fg outline-none placeholder:text-fg-subtle focus-visible:ring-2 focus-visible:ring-orange-300/60',
                            state?.issue === 'pages' &&
                              'ring-2 ring-rose-400/60',
                          )}
                        />
                      </label>
                    )}
                    {state?.issue && (
                      <span className="text-xs text-rose-300 light:text-rose-600">
                        {describeIssue(state.issue, state.total)}
                      </span>
                    )}
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </SettingsCard>
  )
}
