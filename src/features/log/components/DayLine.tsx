import { PencilIcon } from '@/components/icons'
import { cn } from '@/lib/cn'
import type { DateKey } from '@/lib/date'
import { useLineEditing } from '../hooks/useLog'
import { editorLabel } from '../lib/text'
import { LineEditor } from './LineEditor'

/** A written line; tap it to edit. */
export function LineText({
  line,
  onEdit,
  align = 'start',
  className,
}: {
  line: string
  onEdit: () => void
  align?: 'start' | 'center'
  className?: string
}) {
  return (
    <button
      type="button"
      onClick={onEdit}
      aria-label={`Edit: ${line}`}
      className={cn(
        'group block max-w-full rounded-lg text-[15px] leading-relaxed transition',
        align === 'center'
          ? 'mx-auto text-center text-balance'
          : 'text-left text-pretty',
        className,
      )}
    >
      {line}
      <PencilIcon className="ml-1.5 inline align-[-0.1em] text-sm text-fg-subtle opacity-0 transition group-hover:opacity-100 group-focus-visible:opacity-100" />
    </button>
  )
}

interface DayLineProps {
  day: DateKey
  line: string
  /** The prompt shown when the day has no line yet. */
  emptyLabel: string
  placeholder: string
  align?: 'start' | 'center'
  className?: string
  textClassName?: string
}

/** A day's line: shown as text, a prompt to write one, or the editor. */
export function DayLine({
  day,
  line,
  emptyLabel,
  placeholder,
  align = 'start',
  className,
  textClassName,
}: DayLineProps) {
  const { editing, open, close } = useLineEditing(day)

  if (editing) {
    return (
      <LineEditor
        day={day}
        placeholder={placeholder}
        label={editorLabel(day)}
        onDone={close}
        className={className}
      />
    )
  }
  if (!line) {
    return (
      <button
        type="button"
        onClick={open}
        className={cn(
          'inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm text-fg-subtle transition hover:bg-tint hover:text-fg',
          align === 'start' && '-ml-3',
          className,
        )}
      >
        <PencilIcon />
        {emptyLabel}
      </button>
    )
  }
  return (
    <LineText
      line={line}
      onEdit={open}
      align={align}
      className={cn(className, textClassName)}
    />
  )
}
