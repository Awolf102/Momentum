import { Redirect, useParams, useSearch } from 'wouter'
import { useDocuments } from '@/features/library'
import {
  AddDocumentsButton,
  DocumentViewer,
  DropZone,
  LibraryShelf,
} from '@/features/library/page'
import { paths } from '@/lib/routes'

export default function LibraryPage() {
  const { id } = useParams<{ id?: string }>()
  const page = Number(new URLSearchParams(useSearch()).get('page')) || null
  const all = useDocuments()
  if (id) {
    const document = all.find((each) => each.id === id)
    if (!document) return <Redirect to={paths.library} replace />
    return <DocumentViewer key={id} document={document} startPage={page} />
  }
  return (
    <DropZone>
      <div className="mx-auto flex w-full max-w-5xl flex-col pt-2 pb-8 sm:pt-6 lg:pt-2">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h1 className="font-serif text-5xl leading-none tracking-tight text-shadow-soft sm:text-6xl">
              Library
            </h1>
            {all.length > 0 && (
              <p className="mt-3 text-[15px] text-fg-muted text-shadow-soft">
                Read, highlight, and write in the margin.
              </p>
            )}
          </div>
          {all.length > 0 && <AddDocumentsButton />}
        </div>
        <div className="mt-6">
          <LibraryShelf documents={all} />
        </div>
      </div>
    </DropZone>
  )
}
