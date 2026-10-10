import { Link, Redirect, useParams } from 'wouter'
import { ArrowLeftIcon } from '@/components/icons'
import { PhotoNote } from '@/features/capture/page'
import { paths } from '@/lib/routes'

/** Turning something captured into a note: for now, photos. */
export default function CapturePage() {
  const { mode } = useParams<{ mode?: string }>()
  if (mode !== 'photo') return <Redirect to={paths.photoNote} replace />
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col pt-2 pb-8 sm:pt-6 lg:pt-2">
      <div className="mb-6 flex items-center gap-3">
        <Link
          href={paths.notes}
          aria-label="Back to notes"
          className="flex size-10 shrink-0 items-center justify-center rounded-full glass text-lg transition hover:bg-tint"
        >
          <ArrowLeftIcon />
        </Link>
        <div>
          <h1 className="font-serif text-4xl leading-none tracking-tight text-shadow-soft sm:text-5xl">
            Note from a photo
          </h1>
          <p className="mt-2 text-[15px] text-fg-muted text-shadow-soft">
            Handwritten notes, a whiteboard or slides, written out as a note you
            can edit.
          </p>
        </div>
      </div>
      <PhotoNote />
    </div>
  )
}
