import { HighlighterIcon, NoteIcon } from '@/components/icons'
import { cn } from '@/lib/cn'
import type { Highlight, HighlightColor } from '../types'

const BARS: Record<HighlightColor, string> = {
  yellow: 'border-yellow-300',
  green: 'border-green-300',
  blue: 'border-sky-300',
  pink: 'border-pink-300',
}

/** Every highlight in the document, in reading order, with its note. */
export function HighlightsPanel({
  highlights,
  onOpen,
  onMakeNote,
}: {
  highlights: readonly Highlight[]
  onOpen: (highlight: Highlight) => void
  onMakeNote: () => void
}) {
  if (highlights.length === 0) {
    return (
      <div className="px-1 py-2 text-sm leading-relaxed text-fg-muted">
        <HighlighterIcon className="mb-2 text-xl text-orange-300 light:text-orange-500" />
        <p>
          Select text on a page to highlight it, in one of four colours, with a
          note in the margin if you like. Highlights collect here.
        </p>
      </div>
    )
  }
  return (
    <div className="flex flex-col gap-3">
      <button
        type="button"
        onClick={onMakeNote}
        className="inline-flex items-center justify-center gap-1.5 rounded-full bg-tint px-3 py-2 text-xs font-semibold text-fg-muted transition hover:text-fg"
      >
        <NoteIcon /> Make a note of these
      </button>
      <ol className="flex flex-col gap-1">
        {highlights.map((highlight) => (
          <li key={highlight.id}>
            <button
              type="button"
              onClick={() => onOpen(highlight)}
              className="w-full rounded-2xl px-3 py-2.5 text-left transition hover:bg-tint"
            >
              <span className="text-[11px] font-semibold tracking-[0.14em] text-fg-subtle uppercase">
                Page {highlight.page}
              </span>
              <span
                className={cn(
                  'mt-1 line-clamp-3 block border-l-[3px] pl-2.5 text-sm leading-snug',
                  BARS[highlight.color],
                )}
              >
                {highlight.quote}
              </span>
              {highlight.note && (
                <span className="mt-1.5 line-clamp-3 block text-xs leading-relaxed text-fg-muted">
                  {highlight.note}
                </span>
              )}
            </button>
          </li>
        ))}
      </ol>
    </div>
  )
}
