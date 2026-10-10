import {
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react'
import { GlassCard } from '@/components/GlassCard'
import {
  AlertIcon,
  CardsIcon,
  EyeIcon,
  PencilIcon,
  PinIcon,
  PlusIcon,
  QuizIcon,
  TrashIcon,
} from '@/components/icons'
import { SegmentedControl } from '@/components/SegmentedControl'
import {
  SUBJECT_COLORS,
  SubjectPicker,
  subjectsStore,
} from '@/features/subjects'
import { tasks } from '@/features/tasks'
import { cn } from '@/lib/cn'
import { useHotkeys } from '@/lib/hotkeys'
import { navigate, paths } from '@/lib/routes'
import { useStore } from '@/lib/store'
import { toast } from '@/lib/toast'
import { useNoteDraft } from '../hooks/useNoteDraft'
import { caretCoordinates } from '../lib/caret'
import { toggleCheckbox } from '../lib/checkboxes'
import { formatEdited } from '../lib/format'
import { normalizeTitle } from '../lib/links'
import {
  linkQueryAt,
  suggestionId,
  suggestLinks,
  type Suggestion,
} from '../lib/suggest'
import {
  deleteNote,
  MAX_BODY_LENGTH,
  MAX_TITLE_LENGTH,
  notes,
  restoreNote,
  saveNote,
} from '../notes'
import type { Note } from '../types'
import { Backlinks } from './Backlinks'
import { LinkSuggestions } from './LinkSuggestions'
import { MarkdownView } from './MarkdownView'

type Mode = 'write' | 'read'

/** The [[link being typed, and where its suggestions go. */
interface OpenLink {
  start: number
  text: string
  top: number
  left: number
}

const SUGGESTIONS_WIDTH = 256

/** One note: its title, its text (written or read), and what links to it. */
export function NoteEditor({ note }: { note: Note }) {
  const draft = useNoteDraft(note)
  const { title, body, setBody } = draft
  // A note with something in it opens to read; an empty one, to write.
  const [mode, setMode] = useState<Mode>(note.body.trim() ? 'read' : 'write')
  const [startedEmpty] = useState(!note.title && !note.body)
  const titleRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const allNotes = useStore(notes)

  // A new note starts with its title.
  useEffect(() => {
    if (startedEmpty) titleRef.current?.focus()
  }, [startedEmpty])

  /** Puts the caret at the end of the text, ready to carry on. */
  const focusBody = () => {
    const textarea = textareaRef.current
    textarea?.focus()
    textarea?.setSelectionRange(textarea.value.length, textarea.value.length)
  }
  // Switching to Write moves the caret into the text once it's there.
  const focusOnWrite = useRef(false)
  useEffect(() => {
    if (mode !== 'write' || !focusOnWrite.current) return
    focusOnWrite.current = false
    focusBody()
  }, [mode])

  function switchMode(next: Mode) {
    setLink(null)
    if (next === 'write' && mode === 'write') return focusBody()
    focusOnWrite.current = next === 'write'
    setMode(next)
  }

  useHotkeys([{ key: 'e', run: () => mode === 'read' && switchMode('write') }])

  const duplicate = useMemo(() => {
    const key = normalizeTitle(title)
    return (
      key !== '' &&
      allNotes.some(
        (other) => other.id !== note.id && normalizeTitle(other.title) === key,
      )
    )
  }, [allNotes, title, note.id])

  async function remove() {
    draft.flush()
    const { id } = note
    await deleteNote(id)
    navigate(paths.notes)
    toast({
      id: 'note-deleted',
      icon: <TrashIcon className="text-orange-300" />,
      title: 'Note deleted',
      description: note.title || undefined,
      action: {
        label: 'Undo',
        run: () => void restoreNote(id).then(() => navigate(paths.note(id))),
      },
    })
  }

  // Grow the text area with its text, keeping the page where it is.
  useLayoutEffect(() => {
    const textarea = textareaRef.current
    if (!textarea) return
    const scroll = window.scrollY
    textarea.style.height = '0px'
    textarea.style.height = `${textarea.scrollHeight}px`
    if (window.scrollY !== scroll) window.scrollTo({ top: scroll })
  }, [body, mode])

  // [[ suggestions
  const listId = useId()
  const [link, setLink] = useState<OpenLink | null>(null)
  const [active, setActive] = useState(0)
  const allTasks = useStore(tasks)
  const suggestions = useMemo(
    () =>
      link
        ? suggestLinks(link.text, {
            notes: allNotes.filter((other) => other.id !== note.id),
            tasks: allTasks.filter((task) => task.status !== 'done'),
          })
        : [],
    [link, allNotes, allTasks, note.id],
  )
  const open = suggestions.length > 0
  const current = Math.min(active, suggestions.length - 1)

  /** Notices a [[ being typed at the caret. */
  function track(textarea: HTMLTextAreaElement) {
    const { selectionStart, selectionEnd, value } = textarea
    const query =
      selectionStart === selectionEnd
        ? linkQueryAt(value, selectionStart)
        : null
    if (!query) return setLink(null)
    if (link?.start === query.start)
      return setLink({ ...link, text: query.text })
    const caret = caretCoordinates(textarea, query.start - 2)
    setActive(0)
    setLink({
      ...query,
      top: caret.top + caret.height + 6,
      left: Math.max(
        0,
        Math.min(caret.left, textarea.clientWidth - SUGGESTIONS_WIDTH),
      ),
    })
  }

  function pick(suggestion: Suggestion) {
    const textarea = textareaRef.current
    if (!textarea || !link) return
    const end = textarea.selectionStart
    const closed = textarea.value.slice(end).startsWith(']]')
    const text = suggestion.insert + (closed ? '' : ']]')
    textarea.focus()
    textarea.setSelectionRange(link.start, end)
    // Typed in as if by hand, so ⌘Z undoes it.
    if (!document.execCommand('insertText', false, text)) {
      textarea.setRangeText(text, link.start, end, 'end')
      setBody(textarea.value)
    }
    if (closed) {
      const after = link.start + suggestion.insert.length + 2
      textarea.setSelectionRange(after, after)
    }
    setLink(null)
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.nativeEvent.isComposing) return
    if (open) {
      const count = suggestions.length
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault()
        const step = event.key === 'ArrowDown' ? 1 : -1
        setActive((current + step + count) % count)
        return
      }
      if (event.key === 'Enter' || event.key === 'Tab') {
        event.preventDefault()
        pick(suggestions[current])
        return
      }
      if (event.key === 'Escape') {
        event.preventDefault()
        setLink(null)
        return
      }
    }
    // Escape: done writing.
    if (event.key === 'Escape' && body.trim()) {
      event.preventDefault()
      switchMode('read')
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <GlassCard className="px-5 pt-4 pb-6 sm:px-7 sm:pt-5 sm:pb-7">
        {/* On a phone the modes go without icons, so four buttons fit beside them. */}
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
          <div className="w-32 sm:w-44">
            <SegmentedControl<Mode>
              label="Mode"
              value={mode}
              options={[
                {
                  value: 'write',
                  label: 'Write',
                  icon: <PencilIcon className="hidden sm:block" />,
                },
                {
                  value: 'read',
                  label: 'Read',
                  icon: <EyeIcon className="hidden sm:block" />,
                },
              ]}
              onChange={switchMode}
              compact
            />
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              title="Make cards from this note"
              aria-label="Make cards from this note"
              onClick={() => {
                draft.flush()
                navigate(paths.makeCards({ note: note.id }))
              }}
              className="inline-flex size-10 items-center justify-center rounded-full text-lg text-fg-subtle transition hover:bg-tint hover:text-fg"
            >
              <CardsIcon />
            </button>
            <button
              type="button"
              title="Make a practice quiz from this note"
              aria-label="Make a practice quiz from this note"
              onClick={() => {
                draft.flush()
                navigate(paths.newQuiz({ note: note.id }))
              }}
              className="inline-flex size-10 items-center justify-center rounded-full text-lg text-fg-subtle transition hover:bg-tint hover:text-fg"
            >
              <QuizIcon />
            </button>
            <button
              type="button"
              aria-pressed={note.pinned}
              title={note.pinned ? 'Unpin' : 'Pin to the top'}
              aria-label="Pin to the top"
              onClick={() => void saveNote(note.id, { pinned: !note.pinned })}
              className={cn(
                'inline-flex size-10 items-center justify-center rounded-full text-lg transition hover:bg-tint',
                note.pinned
                  ? 'text-orange-300 light:text-orange-500'
                  : 'text-fg-subtle hover:text-fg',
              )}
            >
              <PinIcon />
            </button>
            <button
              type="button"
              title="Delete note"
              aria-label="Delete note"
              onClick={() => void remove()}
              className="inline-flex size-10 items-center justify-center rounded-full text-lg text-fg-subtle transition hover:bg-tint hover:text-fg"
            >
              <TrashIcon />
            </button>
          </div>
        </div>

        <input
          ref={titleRef}
          value={title}
          maxLength={MAX_TITLE_LENGTH}
          onChange={(event) => draft.setTitle(event.target.value)}
          onBlur={draft.commitTitle}
          onKeyDown={(event) => {
            if (event.key !== 'Enter' || event.nativeEvent.isComposing) return
            event.preventDefault()
            draft.commitTitle()
            switchMode('write')
          }}
          placeholder="Untitled"
          aria-label="Title"
          className="mt-5 w-full bg-transparent font-serif text-4xl leading-tight tracking-tight outline-none placeholder:text-fg-subtle focus-visible:outline-none sm:text-[2.75rem]"
        />
        <NoteDetails note={note} duplicate={duplicate} />

        <div className="mt-5 border-t border-line pt-5">
          {mode === 'write' ? (
            <>
              <div className="relative">
                <textarea
                  ref={textareaRef}
                  value={body}
                  maxLength={MAX_BODY_LENGTH}
                  onChange={(event) => {
                    setBody(event.target.value)
                    track(event.target)
                  }}
                  onSelect={(event) => track(event.currentTarget)}
                  onBlur={() => setLink(null)}
                  onKeyDown={onKeyDown}
                  placeholder="Write in markdown…"
                  aria-label="Note"
                  aria-autocomplete="list"
                  aria-controls={open ? listId : undefined}
                  aria-activedescendant={
                    open ? suggestionId(listId, current) : undefined
                  }
                  spellCheck
                  className="block min-h-[45vh] w-full resize-none overflow-hidden bg-transparent text-[15px] leading-[1.7] outline-none placeholder:text-fg-subtle focus-visible:outline-none"
                />
                {open && link && (
                  <LinkSuggestions
                    id={listId}
                    suggestions={suggestions}
                    active={current}
                    position={{ top: link.top, left: link.left }}
                    onPick={pick}
                  />
                )}
              </div>
              <p className="mt-4 text-xs leading-relaxed text-fg-subtle">
                Markdown, with <Code>$maths$</Code>, <Code>```code```</Code>,{' '}
                <Code>- [ ] checklists</Code> and <Code>[[links]]</Code> to
                notes (or <Code>[[task:…]]</Code> to tasks). Saved as you type.
              </p>
            </>
          ) : body.trim() ? (
            <MarkdownView
              markdown={body}
              onToggleCheckbox={(index) => {
                const next = toggleCheckbox(body, index)
                setBody(next)
                void saveNote(note.id, { body: next })
              }}
            />
          ) : (
            <button
              type="button"
              onClick={() => switchMode('write')}
              className="text-[15px] text-fg-subtle transition hover:text-fg-muted"
            >
              Nothing here yet. Start writing…
            </button>
          )}
        </div>
      </GlassCard>
      {note.title && <Backlinks title={note.title} />}
    </div>
  )
}

function Code({ children }: { children: string }) {
  return (
    <code className="rounded-md bg-tint px-1 py-0.5 font-mono text-[0.95em] text-fg-muted">
      {children}
    </code>
  )
}

/** When it was changed, its subject (tap to change), and any warning. */
function NoteDetails({ note, duplicate }: { note: Note; duplicate: boolean }) {
  const [picking, setPicking] = useState(false)
  const { subjects } = useStore(subjectsStore)
  const subject = subjects.find((each) => each.id === note.subjectId)
  return (
    <>
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2 text-xs text-fg-subtle">
        <span>Edited {formatEdited(note.updatedAt)}</span>
        <button
          type="button"
          onClick={() => setPicking((open) => !open)}
          aria-expanded={picking}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-medium transition',
            subject
              ? 'bg-tint text-fg-muted hover:text-fg'
              : 'border border-dashed border-line hover:text-fg',
          )}
        >
          {subject ? (
            <span
              aria-hidden="true"
              className="size-2 rounded-full"
              style={{ background: SUBJECT_COLORS[subject.color] }}
            />
          ) : (
            <PlusIcon />
          )}
          {subject ? subject.name : 'Subject'}
        </button>
        {duplicate && (
          <span className="inline-flex items-center gap-1 text-amber-300 light:text-amber-600">
            <AlertIcon /> Another note has this title; links go to the latest.
          </span>
        )}
      </div>
      {picking && (
        <div className="mt-3">
          <SubjectPicker
            value={note.subjectId}
            onChange={(subjectId) => {
              // Tapping the chosen subject again clears it.
              void saveNote(note.id, {
                subjectId: subjectId === note.subjectId ? null : subjectId,
              })
              setPicking(false)
            }}
          />
        </div>
      )}
    </>
  )
}
