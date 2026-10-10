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
import { filterCommands, type Command } from '@/lib/commands'
import { formatHotkey } from '@/lib/hotkeys'
import { SearchIcon } from './icons'
import { Kbd } from './Kbd'

interface CommandPaletteProps {
  open: boolean
  onClose: () => void
  commands: readonly Command[]
}

/** ⌘K: search and run any action from the keyboard. */
export function CommandPalette({
  open,
  onClose,
  commands,
}: CommandPaletteProps) {
  return createPortal(
    <AnimatePresence>
      {open && <Palette onClose={onClose} commands={commands} />}
    </AnimatePresence>,
    document.body,
  )
}

function Palette({ onClose, commands }: Omit<CommandPaletteProps, 'open'>) {
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const listId = useId()
  const results = useMemo(
    () => filterCommands(commands, query),
    [commands, query],
  )
  const activeIndex = Math.min(active, Math.max(0, results.length - 1))

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

  function run(command: Command | undefined) {
    if (!command) return
    onClose()
    // Let the palette close (and restore focus) before the action opens anything.
    requestAnimationFrame(() => command.run())
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setActive((activeIndex + 1) % Math.max(1, results.length))
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActive(
        (activeIndex - 1 + results.length) % Math.max(1, results.length),
      )
    } else if (event.key === 'Enter') {
      event.preventDefault()
      run(results[activeIndex])
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
              results[activeIndex] ? `${listId}-${activeIndex}` : undefined
            }
            aria-autocomplete="list"
            placeholder="Type a command…"
            className="h-14 w-full bg-transparent text-[15px] text-fg outline-none placeholder:text-fg-subtle"
          />
          <Kbd keys={['esc']} />
        </div>
        <div
          ref={listRef}
          id={listId}
          role="listbox"
          aria-label="Commands"
          className="overflow-y-auto p-2"
        >
          {results.length === 0 && (
            <p className="px-3 py-8 text-center text-sm text-fg-subtle">
              No matching commands
            </p>
          )}
          {results.map((command, index) => {
            // Sections group the full list; search results are ranked instead.
            const showSection =
              !query &&
              (index === 0 || results[index - 1].section !== command.section)
            return (
              <div key={command.id}>
                {showSection && (
                  <p
                    role="presentation"
                    className="px-3 pt-3 pb-1.5 text-[11px] font-semibold tracking-[0.14em] text-fg-subtle uppercase"
                  >
                    {command.section}
                  </p>
                )}
                <div
                  id={`${listId}-${index}`}
                  data-index={index}
                  role="option"
                  aria-selected={index === activeIndex}
                  onPointerMove={() => setActive(index)}
                  onClick={() => run(command)}
                  className={cn(
                    'flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-sm',
                    index === activeIndex ? 'bg-tint text-fg' : 'text-fg-muted',
                  )}
                >
                  <span className="flex w-5 shrink-0 justify-center text-base">
                    {command.icon}
                  </span>
                  <span className="flex-1 truncate">{command.title}</span>
                  {query && (
                    <span className="text-xs text-fg-subtle">
                      {command.section}
                    </span>
                  )}
                  {command.hotkey && (
                    <Kbd keys={formatHotkey(command.hotkey)} />
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
