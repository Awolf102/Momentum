import { useState, type FormEvent } from 'react'
import { InboxIcon } from '@/components/icons'
import { cn } from '@/lib/cn'
import { capture } from '../items'
import { MAX_TEXT_LENGTH } from '../lib/share'
import type { InboxItem } from '../types'

/** Capture anything; Enter saves, Shift+Enter starts a new line. */
export function CaptureField({
  autoFocus,
  onCaptured,
  className,
}: {
  autoFocus?: boolean
  onCaptured?: (item: InboxItem) => void
  className?: string
}) {
  const [text, setText] = useState('')

  async function submit(event?: FormEvent) {
    event?.preventDefault()
    const item = await capture(text)
    if (!item) return
    setText('')
    onCaptured?.(item)
  }

  return (
    <form
      onSubmit={(event) => void submit(event)}
      className={cn(
        'flex items-start gap-2 rounded-2xl bg-tint py-1 pr-1 pl-3.5 ring-1 ring-transparent transition focus-within:ring-orange-300/50',
        className,
      )}
    >
      <InboxIcon className="mt-3 shrink-0 text-base text-fg-subtle" />
      <textarea
        value={text}
        onChange={(event) => setText(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault()
            void submit()
          }
        }}
        autoFocus={autoFocus}
        rows={Math.min(5, Math.max(1, text.split('\n').length))}
        maxLength={MAX_TEXT_LENGTH}
        placeholder="A thought, a link, a to-do…"
        aria-label="Capture"
        enterKeyHint="done"
        className="min-w-0 flex-1 resize-none bg-transparent py-2.5 text-[15px] leading-snug outline-none placeholder:text-fg-subtle focus-visible:outline-none"
      />
      <button
        type="submit"
        disabled={!text.trim()}
        className="mt-0.5 rounded-xl bg-linear-to-br from-amber-300 to-orange-500 px-3.5 py-2 text-xs font-semibold text-orange-950 transition disabled:opacity-0"
      >
        Save
      </button>
    </form>
  )
}
