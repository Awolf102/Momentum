import { useState } from 'react'
import { PlusIcon } from '@/components/icons'
import { cn } from '@/lib/cn'
import { useStore } from '@/lib/store'
import {
  addSubject,
  liveSubjects,
  MAX_NAME_LENGTH,
  subjectsStore,
} from '../store'
import { SubjectDot } from './SubjectDot'

interface SubjectPickerProps {
  value: string | null
  onChange: (subjectId: string | null) => void
  label?: string
}

/** Choose what the next thing is about, or add a new subject on the spot. */
export function SubjectPicker({
  value,
  onChange,
  label = 'Subject',
}: SubjectPickerProps) {
  const subjects = liveSubjects(useStore(subjectsStore))
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')

  function add() {
    const subject = addSubject(name)
    if (subject) onChange(subject.id)
    setName('')
    setAdding(false)
  }

  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2">
      {subjects.map((subject) => {
        const selected = subject.id === value
        return (
          <button
            key={subject.id}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(subject.id)}
            className={cn(
              'inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-sm font-medium ring-1 transition',
              selected
                ? 'bg-orange-400/15 text-fg ring-orange-300/60'
                : 'bg-tint text-fg-muted ring-transparent hover:text-fg',
            )}
          >
            <SubjectDot color={subject.color} />
            {subject.name}
          </button>
        )
      })}
      {adding ? (
        // Not a form of its own: the picker often sits inside one, and a
        // form within a form sends the outer one (reloading the page).
        <span className="inline-flex items-center rounded-full bg-tint py-1 pr-1 pl-3.5 ring-1 ring-orange-300/60">
          <input
            autoFocus
            value={name}
            maxLength={MAX_NAME_LENGTH}
            onChange={(event) => setName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
                // Adds the subject, without sending a form around it.
                event.preventDefault()
                add()
              } else if (event.key === 'Escape') {
                // Closes this box, not the sheet it's in.
                event.preventDefault()
                event.stopPropagation()
                setAdding(false)
              }
            }}
            onBlur={() => !name.trim() && setAdding(false)}
            placeholder="New subject"
            aria-label="New subject name"
            className="w-32 bg-transparent text-sm outline-none placeholder:text-fg-subtle focus-visible:outline-none"
          />
          <button
            type="button"
            onClick={add}
            className="rounded-full px-2.5 py-0.5 text-xs font-semibold transition hover:bg-line"
          >
            Add
          </button>
        </span>
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-line px-3 py-1.5 text-sm text-fg-subtle transition hover:text-fg"
        >
          <PlusIcon /> Add
        </button>
      )}
    </div>
  )
}
