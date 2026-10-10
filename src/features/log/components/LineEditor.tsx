import { useRef, useState } from 'react'
import { cn } from '@/lib/cn'
import type { DateKey } from '@/lib/date'
import { lineFor, setLine } from '../entries'
import { MAX_LINE_LENGTH } from '../lib/text'

interface LineEditorProps {
  day: DateKey
  placeholder: string
  /** What the field is, for screen readers. */
  label: string
  onDone: () => void
  className?: string
}

/** A day's line, written in place. Enter or leaving the field saves; Escape cancels. */
export function LineEditor({
  day,
  placeholder,
  label,
  onDone,
  className,
}: LineEditorProps) {
  const [text, setText] = useState(() => lineFor(day))
  const finished = useRef(false)
  const left = MAX_LINE_LENGTH - text.length

  function finish(save: boolean) {
    if (finished.current) return
    finished.current = true
    if (save) void setLine(day, text)
    onDone()
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        finish(true)
      }}
      className={cn(
        'flex w-full items-center gap-1 rounded-2xl bg-tint py-1 pr-1 pl-4 ring-1 ring-orange-300/50',
        className,
      )}
    >
      <input
        autoFocus
        value={text}
        maxLength={MAX_LINE_LENGTH}
        onChange={(event) => setText(event.target.value)}
        onKeyDown={(event) => {
          if (event.key !== 'Escape') return
          event.preventDefault()
          event.stopPropagation()
          finish(false)
        }}
        onBlur={() => finish(true)}
        placeholder={placeholder}
        aria-label={label}
        enterKeyHint="done"
        className="min-w-0 flex-1 bg-transparent py-1.5 text-[15px] outline-none placeholder:text-fg-subtle focus-visible:outline-none"
      />
      {left <= 30 && (
        <span className="px-1 text-xs text-fg-subtle tabular-nums">
          {left}
          <span className="sr-only"> characters left</span>
        </span>
      )}
      <button
        type="submit"
        // Keeps focus in the field, so the click saves once.
        onMouseDown={(event) => event.preventDefault()}
        className="rounded-xl px-3 py-1.5 text-xs font-semibold text-fg-muted transition hover:bg-line hover:text-fg"
      >
        Save
      </button>
    </form>
  )
}
