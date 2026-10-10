import { useState } from 'react'
import { ActionRow } from '@/components/ActionRow'
import { CardsIcon, NoteIcon, QuizIcon, TrashIcon } from '@/components/icons'
import { Sheet } from '@/components/Sheet'
import { SubjectPicker } from '@/features/subjects'
import { formatDateKey, toDateKey } from '@/lib/date'
import { MAX_TITLE_LENGTH, updateDocument } from '../documents'
import { formatSize } from '../lib/file'
import type { LibraryDocument } from '../types'

/** A document's name, subject and file, and the ways to remove it. */
export function DocumentSheet({
  document,
  open,
  highlightCount,
  onClose,
  onMakeNote,
  onMakeCards,
  onMakeQuiz,
  onDelete,
}: {
  document: LibraryDocument
  open: boolean
  highlightCount: number
  onClose: () => void
  onMakeNote: () => void
  onMakeCards: () => void
  onMakeQuiz: () => void
  onDelete: () => void
}) {
  return (
    <Sheet open={open} onClose={onClose} title="Document">
      <Details
        key={document.id}
        document={document}
        highlightCount={highlightCount}
        onMakeNote={onMakeNote}
        onMakeCards={onMakeCards}
        onMakeQuiz={onMakeQuiz}
        onDelete={onDelete}
      />
    </Sheet>
  )
}

function Details({
  document,
  highlightCount,
  onMakeNote,
  onMakeCards,
  onMakeQuiz,
  onDelete,
}: {
  document: LibraryDocument
  highlightCount: number
  onMakeNote: () => void
  onMakeCards: () => void
  onMakeQuiz: () => void
  onDelete: () => void
}) {
  const [title, setTitle] = useState(document.title)
  const added = formatDateKey(toDateKey(new Date(document.createdAt)), {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
  return (
    <div className="space-y-6">
      <label className="block space-y-2">
        <span className="text-xs font-semibold tracking-[0.14em] text-fg-subtle uppercase">
          Title
        </span>
        <input
          value={title}
          maxLength={MAX_TITLE_LENGTH}
          onChange={(event) => setTitle(event.target.value)}
          onBlur={() => {
            void updateDocument(document.id, { title })
            setTitle((value) => value.trim() || document.title)
          }}
          onKeyDown={(event) =>
            event.key === 'Enter' && event.currentTarget.blur()
          }
          className="h-11 w-full rounded-xl bg-tint px-3 text-[15px] outline-none focus-visible:outline-2"
        />
      </label>
      <div className="space-y-2">
        <p className="text-xs font-semibold tracking-[0.14em] text-fg-subtle uppercase">
          Subject
        </p>
        <SubjectPicker
          value={document.subjectId}
          onChange={(subjectId) =>
            void updateDocument(document.id, {
              // Tapping the chosen subject again clears it.
              subjectId: subjectId === document.subjectId ? null : subjectId,
            })
          }
        />
      </div>
      <p className="text-sm leading-relaxed text-fg-muted">
        {document.fileName || 'PDF'} · {formatSize(document.size)}
        {document.pages
          ? ` · ${document.pages} ${document.pages === 1 ? 'page' : 'pages'}`
          : ''}
        <br />
        Added {added}. Kept on this device only.
      </p>
      <div className="space-y-2">
        {highlightCount > 0 && (
          <ActionRow
            icon={<NoteIcon />}
            label="Make a note of the highlights"
            hint={`${highlightCount}`}
            onClick={onMakeNote}
          />
        )}
        <ActionRow
          icon={<CardsIcon />}
          label="Make cards from this PDF"
          onClick={onMakeCards}
        />
        <ActionRow
          icon={<QuizIcon />}
          label="Make a practice quiz"
          onClick={onMakeQuiz}
        />
        <ActionRow
          icon={<TrashIcon />}
          label="Delete document"
          onClick={onDelete}
          danger
        />
      </div>
    </div>
  )
}
