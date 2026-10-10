import { ChecklistIcon, NoteIcon } from '@/components/icons'
import { cn } from '@/lib/cn'
import { suggestionId, type Suggestion } from '../lib/suggest'

interface LinkSuggestionsProps {
  id: string
  suggestions: readonly Suggestion[]
  active: number
  position: { top: number; left: number }
  onPick: (suggestion: Suggestion) => void
}

/** Notes (or tasks) to link to, under the [[ being typed. */
export function LinkSuggestions({
  id,
  suggestions,
  active,
  position,
  onPick,
}: LinkSuggestionsProps) {
  return (
    <ul
      id={id}
      role="listbox"
      aria-label="Link to"
      style={position}
      className="absolute z-20 w-64 max-w-full rounded-2xl glass-strong p-1.5 text-sm shadow-xl"
    >
      {suggestions.map((suggestion, index) => (
        <li
          key={suggestion.insert}
          id={suggestionId(id, index)}
          role="option"
          aria-selected={index === active}
          // Keep the caret in the text while choosing.
          onMouseDown={(event) => {
            event.preventDefault()
            onPick(suggestion)
          }}
          className={cn(
            'flex cursor-pointer items-center gap-2.5 rounded-xl px-3 py-2',
            index === active ? 'bg-fg/10 text-fg' : 'text-fg-muted',
          )}
        >
          {suggestion.kind === 'task' ? (
            <ChecklistIcon className="shrink-0" />
          ) : (
            <NoteIcon className="shrink-0" />
          )}
          <span className="truncate">{suggestion.label}</span>
        </li>
      ))}
    </ul>
  )
}
