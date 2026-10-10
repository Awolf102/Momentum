import { Link, Redirect, useParams, useSearch } from 'wouter'
import { ArrowLeftIcon } from '@/components/icons'
import {
  CardSheet,
  CardsHome,
  MakeCards,
  ReviewSession,
} from '@/features/flashcards/page'
import { paths } from '@/lib/routes'

/** `?subject=` as the review takes it: an id, "none" (no subject), or all. */
function subjectParam(value: string | null): string | null | undefined {
  if (value === null) return undefined
  return value === 'none' ? null : value
}

export default function CardsPage() {
  const { view } = useParams<{ view?: string }>()
  const params = new URLSearchParams(useSearch())

  if (view === 'review')
    return (
      <div className="flex w-full flex-1 flex-col pt-2 pb-8 sm:pt-6 lg:pt-2">
        <ReviewSession subjectId={subjectParam(params.get('subject'))} />
        <CardSheet />
      </div>
    )

  if (view === 'make')
    return (
      <div className="mx-auto flex w-full max-w-3xl flex-col pt-2 pb-8 sm:pt-6 lg:pt-2">
        <div className="mb-6 flex items-center gap-3">
          <Link
            href={paths.cards}
            aria-label="Back to cards"
            className="flex size-10 shrink-0 items-center justify-center rounded-full glass text-lg transition hover:bg-tint"
          >
            <ArrowLeftIcon />
          </Link>
          <h1 className="font-serif text-4xl leading-none tracking-tight text-shadow-soft sm:text-5xl">
            Make cards
          </h1>
        </div>
        <MakeCards
          noteId={params.get('note')}
          documentId={params.get('document')}
          page={Number(params.get('page')) || null}
        />
      </div>
    )

  if (view) return <Redirect to={paths.cards} replace />

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col pt-2 pb-8 sm:pt-6 lg:pt-2">
      <h1 className="font-serif text-5xl leading-none tracking-tight text-shadow-soft sm:text-6xl">
        Cards
      </h1>
      <p className="mt-3 text-[15px] text-fg-muted text-shadow-soft">
        Questions and answers that come back just before you’d forget them.
      </p>
      <div className="mt-6">
        <CardsHome />
      </div>
      <CardSheet />
    </div>
  )
}
