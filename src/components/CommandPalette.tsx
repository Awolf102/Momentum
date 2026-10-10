import { AnimatePresence, motion } from 'motion/react'
import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/cn'
import {
  filterCommands,
  type Command,
  type MarkedText,
  type MeaningSearch,
  type PaletteResult,
} from '@/lib/commands'
import { formatHotkey } from '@/lib/hotkeys'
import { SearchIcon, SparkleIcon } from './icons'
import { Kbd } from './Kbd'

interface CommandPaletteProps {
  open: boolean
  onClose: () => void
  commands: readonly Command[]
  /** Finds things (notes, tasks…) to list under the matching commands. */
  search?: (query: string) => readonly PaletteResult[]
  /** Finds notes and passages by meaning, listed after the rest. */
  meaning?: MeaningSearch | null
}

/** ⌘K: search everything, and run any action, from the keyboard. */
export function CommandPalette({
  open,
  onClose,
  commands,
  search,
  meaning,
}: CommandPaletteProps) {
  return createPortal(
    <AnimatePresence>
      {open && (
        <Palette
          onClose={onClose}
          commands={commands}
          search={search}
          meaning={meaning}
        />
      )}
    </AnimatePresence>,
    document.body,
  )
}

type Row =
  | { type: 'command'; id: string; section: string; command: Command }
  | { type: 'result'; id: string; section: string; result: PaletteResult }
  /** "Search by meaning", when the search has to be sent to be run. */
  | { type: 'ask'; id: string; section: string }

const MEANING_SECTION = 'By meaning'
/** Shorter searches than this aren't worth searching by meaning. */
const MEANING_MIN = 3

/** What a search by meaning found, for one query. */
interface MeaningFound {
  query: string
  status: 'loading' | 'done' | 'error'
  results: readonly PaletteResult[]
}

/** Text with its matched parts marked. */
function Marked({ parts }: { parts: readonly MarkedText[] }) {
  return parts.map((part, index) =>
    part.match ? (
      <mark
        key={index}
        className="bg-transparent font-semibold text-orange-300 light:text-orange-600"
      >
        {part.text}
      </mark>
    ) : (
      part.text
    ),
  )
}

function Palette({
  onClose,
  commands,
  search,
  meaning,
}: Omit<CommandPaletteProps, 'open'>) {
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const [meaningFound, setMeaningFound] = useState<MeaningFound | null>(null)
  const asked = useRef<AbortController | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const listId = useId()
  const text = query.trim()
  // Only what was found for the query as it is now.
  const byMeaning =
    meaning && meaningFound?.query === text ? meaningFound : null
  const canAsk =
    meaning?.mode === 'ask' &&
    text.length >= MEANING_MIN &&
    byMeaning?.status !== 'done'

  const found = useMemo(
    () => (text && search ? search(query) : []),
    [query, text, search],
  )
  // Something already found by its words isn't listed again.
  const alike = useMemo(() => {
    const listed = new Set(found.map((result) => result.opens ?? result.id))
    return (byMeaning?.results ?? []).filter(
      (result) => !result.opens || !listed.has(result.opens),
    )
  }, [found, byMeaning])

  const rows = useMemo((): Row[] => {
    const matching = filterCommands(commands, query)
    const anything = found.length + alike.length > 0
    return [
      ...matching.map((command) => ({
        type: 'command' as const,
        id: command.id,
        // Searching, the commands are one group above what was found.
        section: query && anything ? 'Commands' : command.section,
        command,
      })),
      ...[...found, ...alike].map((result) => ({
        type: 'result' as const,
        id: result.id,
        section: result.section,
        result,
      })),
      ...(canAsk
        ? [
            {
              type: 'ask' as const,
              id: 'meaning:ask',
              section: MEANING_SECTION,
            },
          ]
        : []),
    ]
  }, [commands, query, found, alike, canAsk])
  const searching = rows.some((row) => row.type !== 'command')
  const activeIndex = Math.min(active, Math.max(0, rows.length - 1))

  // On this device, search by meaning runs as you type (nothing is sent).
  useEffect(() => {
    if (meaning?.mode !== 'auto' || text.length < MEANING_MIN) return
    const controller = new AbortController()
    const timer = setTimeout(() => {
      setMeaningFound({ query: text, status: 'loading', results: [] })
      meaning.find(text, controller.signal).then(
        (results) =>
          controller.signal.aborted ||
          setMeaningFound({ query: text, status: 'done', results }),
        () =>
          controller.signal.aborted ||
          setMeaningFound({ query: text, status: 'error', results: [] }),
      )
    }, 250)
    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [meaning, text])

  useEffect(() => () => asked.current?.abort(), [])

  /** With a provider, the search is sent only when you choose to. */
  function askMeaning() {
    if (!meaning || byMeaning?.status === 'loading') return
    asked.current?.abort()
    const controller = new AbortController()
    asked.current = controller
    const sent = text
    setMeaningFound({ query: sent, status: 'loading', results: [] })
    meaning.find(sent, controller.signal).then(
      (results) =>
        controller.signal.aborted ||
        setMeaningFound({ query: sent, status: 'done', results }),
      () =>
        controller.signal.aborted ||
        setMeaningFound({ query: sent, status: 'error', results: [] }),
    )
  }

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null
    inputRef.current?.focus()
    return () => previouslyFocused?.focus()
  }, [])

  useEffect(() => {
    listRef.current
      ?.querySelector(`[data-index="${activeIndex}"]`)
      ?.scrollIntoView({ block: 'nearest' })
  }, [activeIndex])

  function run(row: Row | undefined) {
    if (!row) return
    if (row.type === 'ask') {
      askMeaning()
      return
    }
    onClose()
    // Let the palette close (and restore focus) before the action opens anything.
    const action = row.type === 'command' ? row.command.run : row.result.run
    requestAnimationFrame(() => action())
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setActive((activeIndex + 1) % Math.max(1, rows.length))
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActive((activeIndex - 1 + rows.length) % Math.max(1, rows.length))
    } else if (event.key === 'Enter') {
      event.preventDefault()
      run(rows[activeIndex])
    } else if (event.key === 'Escape') {
      event.preventDefault()
      onClose()
    } else if (event.key === 'Tab') {
      event.preventDefault()
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-center px-3 pt-[12vh]">
      <motion.div
        className="absolute inset-0 bg-black/40"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      />
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        initial={{ opacity: 0, y: -12, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{
          opacity: 0,
          y: -8,
          scale: 0.98,
          transition: { duration: 0.12 },
        }}
        transition={{ type: 'spring', stiffness: 500, damping: 36 }}
        className="relative flex h-fit max-h-[70vh] w-full max-w-lg flex-col overflow-hidden rounded-3xl glass-strong"
      >
        <div className="flex items-center gap-3 border-b border-line px-5">
          <SearchIcon className="shrink-0 text-lg text-fg-subtle" />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value)
              setActive(0)
            }}
            onKeyDown={onKeyDown}
            role="combobox"
            aria-expanded="true"
            aria-controls={listId}
            aria-activedescendant={
              rows[activeIndex] ? `${listId}-${activeIndex}` : undefined
            }
            aria-autocomplete="list"
            aria-label="Search or run a command"
            placeholder={
              search ? 'Search, or type a command…' : 'Type a command…'
            }
            className="h-14 w-full bg-transparent text-[15px] text-fg outline-none placeholder:text-fg-subtle"
          />
          <Kbd keys={['esc']} />
        </div>
        <div
          ref={listRef}
          id={listId}
          role="listbox"
          aria-label={search ? 'Commands and results' : 'Commands'}
          className="overflow-y-auto p-2"
        >
          {rows.length === 0 && (
            <p className="px-3 py-8 text-center text-sm text-fg-subtle">
              {byMeaning?.status === 'loading'
                ? 'Searching by meaning…'
                : search && text
                  ? `Nothing matches “${text}”`
                  : 'No matching commands'}
            </p>
          )}
          {rows.map((row, index) => {
            // The full list and search results are grouped; commands alone
            // matching a query are ranked, each labelled with its group.
            const grouped = !query || searching
            const showSection =
              grouped &&
              (index === 0 || rows[index - 1].section !== row.section)
            return (
              <div key={row.id}>
                {showSection && (
                  <p
                    role="presentation"
                    className="px-3 pt-3 pb-1.5 text-[11px] font-semibold tracking-[0.14em] text-fg-subtle uppercase"
                  >
                    {row.section}
                  </p>
                )}
                <div
                  id={`${listId}-${index}`}
                  data-index={index}
                  role="option"
                  aria-selected={index === activeIndex}
                  onPointerMove={() => setActive(index)}
                  onClick={() => run(row)}
                  className={cn(
                    'flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-sm',
                    index === activeIndex ? 'bg-tint text-fg' : 'text-fg-muted',
                  )}
                >
                  {row.type === 'ask' ? (
                    <>
                      <span className="flex w-5 shrink-0 justify-center self-start pt-0.5 text-base text-orange-300 light:text-orange-500">
                        <SparkleIcon />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate">
                          {byMeaning?.status === 'loading'
                            ? 'Searching by meaning…'
                            : byMeaning?.status === 'error'
                              ? 'Couldn’t search by meaning. Try again'
                              : 'Search by meaning'}
                        </span>
                        {/* Who it goes to first, so a long search can't hide it. */}
                        <span className="mt-0.5 block truncate text-xs text-fg-subtle">
                          Sends to {meaning?.sendsTo}: “{text}”
                        </span>
                      </span>
                    </>
                  ) : row.type === 'command' ? (
                    <>
                      <span className="flex w-5 shrink-0 justify-center text-base">
                        {row.command.icon}
                      </span>
                      <span className="flex-1 truncate">
                        {row.command.title}
                      </span>
                      {!grouped && (
                        <span className="text-xs text-fg-subtle">
                          {row.command.section}
                        </span>
                      )}
                      {row.command.hotkey && (
                        <Kbd keys={formatHotkey(row.command.hotkey)} />
                      )}
                    </>
                  ) : (
                    <>
                      <span className="flex w-5 shrink-0 justify-center self-start pt-0.5 text-base">
                        {row.result.icon}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate">
                          <Marked parts={row.result.title} />
                        </span>
                        {row.result.snippet && (
                          <span className="mt-0.5 block truncate text-xs text-fg-subtle">
                            <Marked parts={row.result.snippet} />
                          </span>
                        )}
                      </span>
                      {row.result.detail && (
                        <span className="shrink-0 self-start pt-0.5 text-xs text-fg-subtle">
                          {row.result.detail}
                        </span>
                      )}
                    </>
                  )}
                </div>
              </div>
            )
          })}
          {byMeaning && rows.length > 0 && byMeaning.status !== 'loading' && (
            <MeaningNote found={byMeaning} shown={alike.length} />
          )}
          {meaning?.mode === 'auto' &&
            byMeaning?.status === 'loading' &&
            rows.length > 0 && (
              <p
                role="status"
                className="px-3 pt-3 pb-2 text-xs text-fg-subtle"
              >
                Searching by meaning…
              </p>
            )}
        </div>
      </motion.div>
    </div>
  )
}

/** Says when a search by meaning found nothing new, or failed. */
function MeaningNote({
  found,
  shown,
}: {
  found: MeaningFound
  /** Results listed (the rest were already found by their words). */
  shown: number
}) {
  if (found.status === 'error')
    return (
      <p
        role="status"
        className="px-3 pt-3 pb-2 text-xs text-rose-300 light:text-rose-600"
      >
        Couldn’t search by meaning. Check Settings → AI, then try again.
      </p>
    )
  if (shown > 0) return null
  return (
    <p role="status" className="px-3 pt-3 pb-2 text-xs text-fg-subtle">
      {found.results.length > 0
        ? 'Nothing else close in meaning.'
        : 'Nothing close in meaning.'}
    </p>
  )
}
