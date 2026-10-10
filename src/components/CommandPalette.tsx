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
  type PaletteResult,
} from '@/lib/commands'
import { formatHotkey } from '@/lib/hotkeys'
import { SearchIcon } from './icons'
import { Kbd } from './Kbd'

interface CommandPaletteProps {
  open: boolean
  onClose: () => void
  commands: readonly Command[]
  /** Finds things (notes, tasks…) to list under the matching commands. */
  search?: (query: string) => readonly PaletteResult[]
}

/** ⌘K: search everything, and run any action, from the keyboard. */
export function CommandPalette({
  open,
  onClose,
  commands,
  search,
}: CommandPaletteProps) {
  return createPortal(
    <AnimatePresence>
      {open && (
        <Palette onClose={onClose} commands={commands} search={search} />
      )}
    </AnimatePresence>,
    document.body,
  )
}

type Row =
  | { type: 'command'; id: string; section: string; command: Command }
  | { type: 'result'; id: string; section: string; result: PaletteResult }

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
}: Omit<CommandPaletteProps, 'open'>) {
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const listId = useId()
  const rows = useMemo((): Row[] => {
    const found = query.trim() && search ? search(query) : []
    const matching = filterCommands(commands, query)
    return [
      ...matching.map((command) => ({
        type: 'command' as const,
        id: command.id,
        // Searching, the commands are one group above what was found.
        section: query && found.length ? 'Commands' : command.section,
        command,
      })),
      ...found.map((result) => ({
        type: 'result' as const,
        id: result.id,
        section: result.section,
        result,
      })),
    ]
  }, [commands, query, search])
  const searching = rows.some((row) => row.type === 'result')
  const activeIndex = Math.min(active, Math.max(0, rows.length - 1))

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
              {search && query.trim()
                ? `Nothing matches “${query.trim()}”`
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
                  {row.type === 'command' ? (
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
        </div>
      </motion.div>
    </div>
  )
}
