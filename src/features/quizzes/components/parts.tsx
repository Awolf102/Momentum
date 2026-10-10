import { Link } from 'wouter'
import { LibraryIcon, NoteIcon } from '@/components/icons'
import { documents } from '@/features/library'
import { notes } from '@/features/notes'
import { cn } from '@/lib/cn'
import { paths } from '@/lib/routes'
import { useStore } from '@/lib/store'
import type { QuestionSource, Quiz } from '../types'

/**
 * Where a question's answer is, as a link back to it: the note, or the
 * document at its page. A source since deleted is named, not linked.
 */
export function SourceLink({
  source,
  quiz,
  className,
}: {
  source: QuestionSource | null
  quiz: Quiz
  className?: string
}) {
  const allNotes = useStore(notes)
  const library = useStore(documents)
  if (!source) return null
  const note =
    source.kind === 'note'
      ? allNotes.find((each) => each.id === source.id)
      : undefined
  const document =
    source.kind === 'document'
      ? library.find((each) => each.id === source.id)
      : undefined
  const title =
    note?.title ||
    document?.title ||
    quiz.sources.find((each) => each.id === source.id)?.title ||
    'Untitled'
  const label = `${title}${source.page ? `, page ${source.page}` : ''}`
  const icon =
    source.kind === 'note' ? (
      <NoteIcon className="shrink-0" />
    ) : (
      <LibraryIcon className="shrink-0" />
    )
  const style = cn(
    'inline-flex max-w-full min-w-0 items-center gap-1.5 text-xs',
    className,
  )
  if (!note && !document)
    return (
      <span className={cn(style, 'text-fg-subtle')}>
        {icon}
        <span className="truncate">{label} (deleted)</span>
      </span>
    )
  return (
    <Link
      href={
        note
          ? paths.note(note.id)
          : paths.document(document!.id, source.page ?? undefined)
      }
      className={cn(
        style,
        'font-medium text-orange-300 underline-offset-2 hover:underline light:text-orange-600',
      )}
    >
      {icon}
      <span className="truncate">{label}</span>
    </Link>
  )
}
