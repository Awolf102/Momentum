import { useEffect, useRef, useState, type ReactNode } from 'react'
import { PencilIcon, TrashIcon } from '@/components/icons'
import { cn } from '@/lib/cn'
import { MAX_NOTE_LENGTH } from '../highlights'
import { HIGHLIGHT_COLORS, type Highlight, type HighlightColor } from '../types'

const SWATCHES: Record<HighlightColor, string> = {
  yellow: 'bg-yellow-300',
  green: 'bg-green-300',
  blue: 'bg-sky-300',
  pink: 'bg-pink-300',
}
const NAMES: Record<HighlightColor, string> = {
  yellow: 'Yellow',
  green: 'Green',
  blue: 'Blue',
  pink: 'Pink',
}

export interface Anchor {
  left: number
  top: number
  right: number
  bottom: number
}

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), Math.max(min, max))

/** A floating panel by an anchor: above it if there's room, else below. */
function Floating({
  anchor,
  width,
  height,
  label,
  onClose,
  children,
}: {
  anchor: Anchor
  width: number
  height: number
  label: string
  onClose: () => void
  children: ReactNode
}) {
  const panel = useRef<HTMLDivElement>(null)
  // Closes on Escape, or a press anywhere else.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && onClose()
    const onPress = (event: PointerEvent) =>
      !panel.current?.contains(event.target as Node) && onClose()
    document.addEventListener('keydown', onKey)
    document.addEventListener('pointerdown', onPress, true)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('pointerdown', onPress, true)
    }
  }, [onClose])
  const below = anchor.top - height - 12 < 88
  const top = below ? anchor.bottom + 12 : anchor.top - height - 12
  const left = clamp(
    (anchor.left + anchor.right) / 2 - width / 2,
    8,
    window.innerWidth - width - 8,
  )
  return (
    <div
      ref={panel}
      role="dialog"
      aria-label={label}
      style={{
        left,
        top: clamp(top, 8, window.innerHeight - height - 8),
        width,
      }}
      className="fixed z-40 rounded-2xl glass-strong p-2 shadow-xl"
    >
      {children}
    </div>
  )
}

function Swatches({
  value,
  onPick,
}: {
  value?: HighlightColor
  onPick: (color: HighlightColor) => void
}) {
  return (
    <div className="flex items-center gap-1">
      {HIGHLIGHT_COLORS.map((color) => (
        <button
          key={color}
          type="button"
          aria-label={`Highlight ${NAMES[color].toLowerCase()}`}
          aria-pressed={value === undefined ? undefined : value === color}
          title={NAMES[color]}
          onClick={() => onPick(color)}
          className="flex size-9 items-center justify-center rounded-full transition hover:bg-tint"
        >
          <span
            className={cn(
              'size-5 rounded-full ring-2 ring-offset-2 ring-offset-transparent',
              SWATCHES[color],
              value === color ? 'ring-fg' : 'ring-transparent',
            )}
          />
        </button>
      ))}
    </div>
  )
}

/** Shown by selected text: highlight it in a colour, or with a note. */
export function SelectionMenu({
  anchor,
  onPick,
  onNote,
  onClose,
}: {
  anchor: Anchor
  onPick: (color: HighlightColor) => void
  onNote: () => void
  onClose: () => void
}) {
  return (
    <Floating
      anchor={anchor}
      width={272}
      height={52}
      label="Highlight"
      onClose={onClose}
    >
      <div className="flex items-center gap-1">
        <Swatches onPick={onPick} />
        <span className="mx-1 h-6 w-px bg-line" />
        <button
          type="button"
          onClick={onNote}
          className="inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-sm font-medium text-fg-muted transition hover:bg-tint hover:text-fg"
        >
          <PencilIcon /> Note
        </button>
      </div>
    </Floating>
  )
}

/** A highlight's colour and margin note, or deleting it. */
export function HighlightMenu({
  highlight,
  anchor,
  focusNote,
  onChange,
  onDelete,
  onClose,
}: {
  highlight: Highlight
  anchor: Anchor
  focusNote: boolean
  onChange: (changes: { color?: HighlightColor; note?: string }) => void
  onDelete: () => void
  onClose: () => void
}) {
  const [note, setNote] = useState(highlight.note)
  // The note is saved as the menu closes, however it closes.
  const latest = useRef({ note, saved: highlight.note, onChange })
  useEffect(() => {
    latest.current = { note, saved: highlight.note, onChange }
  })
  useEffect(
    () => () => {
      const { note, saved, onChange } = latest.current
      if (note !== saved) onChange({ note })
    },
    [],
  )
  return (
    <Floating
      anchor={anchor}
      width={300}
      height={196}
      label="Highlight"
      onClose={onClose}
    >
      <div className="flex items-center justify-between gap-2">
        <Swatches
          value={highlight.color}
          onPick={(color) => onChange({ color })}
        />
        <button
          type="button"
          onClick={onDelete}
          aria-label="Delete highlight"
          title="Delete highlight"
          className="flex size-9 items-center justify-center rounded-full text-fg-subtle transition hover:bg-tint hover:text-fg"
        >
          <TrashIcon />
        </button>
      </div>
      <textarea
        autoFocus={focusNote}
        value={note}
        maxLength={MAX_NOTE_LENGTH}
        onChange={(event) => setNote(event.target.value)}
        placeholder="A note in the margin…"
        aria-label="Note"
        rows={4}
        className="mt-2 block w-full resize-none rounded-xl bg-tint px-3 py-2 text-sm leading-relaxed outline-none placeholder:text-fg-subtle focus-visible:outline-2"
      />
    </Floating>
  )
}
