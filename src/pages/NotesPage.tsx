import { lazy, Suspense, useEffect } from 'react'
import { Link, Redirect, useParams } from 'wouter'
import { ArrowLeftIcon } from '@/components/icons'
import { useAiReadiness } from '@/features/ai'
import { isEmptyNote, tidyEmptyNotes, useNotes } from '@/features/notes'
import {
  NewNoteButton,
  NoteEditor,
  NotesList,
  NotesWelcome,
} from '@/features/notes/page'
import { cn } from '@/lib/cn'
import { paths } from '@/lib/routes'

// Notes close in meaning, once embeddings are set up (loaded only then).
const RelatedList = lazy(() =>
  import('@/features/embeddings').then((module) => ({
    default: module.RelatedList,
  })),
)

export default function NotesPage() {
  const { id } = useParams<{ id?: string }>()
  const embeddings = useAiReadiness('embeddings')
  const all = useNotes()
  const note = id ? all.find((each) => each.id === id) : undefined
  // Empty notes aren't listed (unless open), and are tidied away once left.
  const listed = all.filter((each) => each.id === id || !isEmptyNote(each))
  useEffect(() => void tidyEmptyNotes(id), [id])

  // A link to a note that's gone (deleted, or from another device).
  if (id && !note) return <Redirect to={paths.notes} replace />

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col pt-2 pb-8 sm:pt-6 lg:pt-2">
      <div className="grid items-start gap-6 lg:grid-cols-[17rem_minmax(0,1fr)]">
        <div
          className={cn(
            'flex flex-col gap-4 lg:sticky lg:top-8 lg:max-h-[calc(100dvh-4rem)]',
            note && 'max-lg:hidden',
          )}
        >
          <div className="flex items-end justify-between gap-4">
            <h1 className="font-serif text-5xl leading-none tracking-tight text-shadow-soft sm:text-6xl">
              Notes
            </h1>
            {listed.length > 0 && <NewNoteButton />}
          </div>
          {listed.length > 0 ? (
            <NotesList notes={listed} currentId={id} />
          ) : (
            <p className="text-[15px] text-fg-muted text-shadow-soft lg:hidden">
              Markdown, maths and code, linked with [[double brackets]].
            </p>
          )}
        </div>
        <div
          className={cn(
            'flex flex-col',
            !note && listed.length > 0 && 'max-lg:hidden',
          )}
        >
          {note ? (
            <>
              <Link
                href={paths.notes}
                className="mb-3 inline-flex items-center gap-1.5 self-start rounded-full px-2 py-1 text-sm font-medium text-fg-muted transition text-shadow-soft hover:text-fg lg:hidden"
              >
                <ArrowLeftIcon /> Notes
              </Link>
              <NoteEditor key={note.id} note={note} />
              {embeddings.ready && (
                <Suspense fallback={null}>
                  <div className="mt-4">
                    <RelatedList noteId={note.id} />
                  </div>
                </Suspense>
              )}
            </>
          ) : (
            <NotesWelcome empty={listed.length === 0} />
          )}
        </div>
      </div>
    </div>
  )
}
