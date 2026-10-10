import { useMemo, useState } from 'react'
import { Link } from 'wouter'
import { GlassCard } from '@/components/GlassCard'
import { PinIcon, SearchIcon } from '@/components/icons'
import { SubjectDot, subjectsStore } from '@/features/subjects'
import { cn } from '@/lib/cn'
import { paths } from '@/lib/routes'
import { useStore } from '@/lib/store'
import { excerpt } from '../lib/excerpt'
import { formatEdited } from '../lib/format'
import type { Note } from '../types'

// A note's preview, worked out once per version of it.
const previews = new WeakMap<Note, string>()
function preview(note: Note): string {
  let text = previews.get(note)
  if (text === undefined) {
    text = excerpt(note.body.slice(0, 2000), 140)
    previews.set(note, text)
  }
  return text
}

/** Every note, to pick one: a filter, then title, opening words and date. */
export function NotesList({
  notes,
  currentId,
}: {
  notes: readonly Note[]
  currentId?: string
}) {
  const [filter, setFilter] = useState('')
  const [subjectId, setSubjectId] = useState<string | null>(null)
  const { subjects } = useStore(subjectsStore)
  const byId = useMemo(
    () => new Map(subjects.map((subject) => [subject.id, subject])),
    [subjects],
  )
  // Subjects to filter by: the ones notes have.
  const used = subjects.filter((subject) =>
    notes.some((note) => note.subjectId === subject.id),
  )
  const wanted = filter.trim().toLowerCase()
  const shown = notes.filter(
    (note) =>
      (!subjectId || note.subjectId === subjectId) &&
      (!wanted ||
        note.title.toLowerCase().includes(wanted) ||
        note.body.toLowerCase().includes(wanted)),
  )

  return (
    <div className="flex min-h-0 flex-col gap-3">
      {notes.length > 0 && (
        <label className="flex items-center gap-2.5 rounded-full glass px-4">
          <SearchIcon className="shrink-0 text-fg-subtle" />
          <input
            type="search"
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            placeholder="Filter notes"
            aria-label="Filter notes"
            className="h-11 w-full bg-transparent text-sm outline-none placeholder:text-fg-subtle focus-visible:outline-none"
          />
        </label>
      )}
      {used.length > 1 && (
        <div
          role="radiogroup"
          aria-label="Subject"
          className="flex flex-wrap gap-1.5"
        >
          {[null, ...used].map((subject) => {
            const selected = (subject?.id ?? null) === subjectId
            return (
              <button
                key={subject?.id ?? 'all'}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => setSubjectId(subject?.id ?? null)}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition',
                  selected
                    ? 'bg-fg/12 text-fg'
                    : 'text-fg-subtle hover:bg-tint hover:text-fg-muted',
                )}
              >
                {subject && (
                  <SubjectDot color={subject.color} className="size-2" />
                )}
                {subject?.name ?? 'All'}
              </button>
            )
          })}
        </div>
      )}
      {shown.length > 0 ? (
        <GlassCard
          as="ul"
          className="min-h-0 overflow-y-auto overscroll-contain p-1.5"
        >
          {shown.map((note) => {
            const subject = note.subjectId ? byId.get(note.subjectId) : null
            const text = preview(note)
            const current = note.id === currentId
            return (
              <li key={note.id}>
                <Link
                  href={paths.note(note.id)}
                  aria-current={current ? 'page' : undefined}
                  className={cn(
                    'block rounded-[22px] px-4 py-3 transition',
                    current ? 'bg-fg/10' : 'hover:bg-tint',
                  )}
                >
                  <span className="flex items-center gap-1.5">
                    {note.pinned && (
                      <PinIcon
                        aria-label="Pinned"
                        aria-hidden={false}
                        role="img"
                        className="shrink-0 text-sm text-orange-300 light:text-orange-500"
                      />
                    )}
                    <span
                      className={cn(
                        'truncate font-medium',
                        !note.title && 'text-fg-subtle',
                      )}
                    >
                      {note.title || 'Untitled'}
                    </span>
                  </span>
                  {text && (
                    <span className="mt-0.5 line-clamp-2 text-sm leading-snug text-fg-muted">
                      {text}
                    </span>
                  )}
                  <span className="mt-1.5 flex items-center gap-2 text-xs text-fg-subtle">
                    <time dateTime={note.updatedAt}>
                      {formatEdited(note.updatedAt)}
                    </time>
                    {subject && (
                      <span className="inline-flex min-w-0 items-center gap-1.5">
                        <SubjectDot color={subject.color} className="size-2" />
                        <span className="truncate">{subject.name}</span>
                      </span>
                    )}
                  </span>
                </Link>
              </li>
            )
          })}
        </GlassCard>
      ) : (
        notes.length > 0 && (
          <p className="px-2 py-3 text-sm text-fg-muted">
            No notes match{wanted ? ` “${filter.trim()}”` : ''}.
          </p>
        )
      )}
    </div>
  )
}
