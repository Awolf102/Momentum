import { useEffect } from 'react'
import { GlassCard } from '@/components/GlassCard'
import { LibraryIcon } from '@/components/icons'
import { readUnread } from '../actions'
import { purgeDeletedFiles } from '../documents'
import type { LibraryDocument } from '../types'
import { AddDocumentsButton } from './AddDocuments'
import { DocumentCard } from './DocumentCard'

/** Every document, as a shelf of first pages. */
export function LibraryShelf({
  documents,
}: {
  documents: readonly LibraryDocument[]
}) {
  // Catch up: read documents restored without their details, and free the
  // space of ones deleted a while ago.
  useEffect(() => {
    void readUnread()
    void purgeDeletedFiles()
  }, [])

  if (documents.length === 0) {
    return (
      <GlassCard className="px-6 py-8 text-center sm:px-10">
        <LibraryIcon className="mx-auto text-3xl text-orange-300 light:text-orange-500" />
        <h2 className="mt-3 font-serif text-3xl leading-tight">Your library</h2>
        <p className="mx-auto mt-2 max-w-md text-[15px] leading-relaxed text-pretty text-fg-muted">
          Lecture slides, papers, textbook chapters: add them as PDFs to read
          here, highlight what matters and write in the margin. They stay on
          this device, and Search finds the words inside them.
        </p>
        <div className="mt-6">
          <AddDocumentsButton />
        </div>
        <p className="mt-3 text-xs text-fg-subtle">
          Or drop PDFs anywhere on this page.
        </p>
      </GlassCard>
    )
  }
  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
      {documents.map((document) => (
        <li key={document.id}>
          <DocumentCard document={document} />
        </li>
      ))}
    </ul>
  )
}
