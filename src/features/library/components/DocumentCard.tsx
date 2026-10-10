import { Link } from 'wouter'
import { SubjectDot, subjectsStore } from '@/features/subjects'
import { paths } from '@/lib/routes'
import { useStore } from '@/lib/store'
import { readingStore } from '../actions'
import { useThumb } from '../hooks/useLibrary'
import { formatSize } from '../lib/file'
import type { LibraryDocument } from '../types'

/** A document on the library's shelf: its first page, title and progress. */
export function DocumentCard({ document }: { document: LibraryDocument }) {
  const thumb = useThumb(document.id, document.pages !== null)
  const { reading, failed, locked } = useStore(readingStore)
  const { subjects } = useStore(subjectsStore)
  const subject = subjects.find((each) => each.id === document.subjectId)
  const started = document.lastOpenedAt !== null && document.pages
  const progress = started ? document.lastPage / (document.pages ?? 1) : 0
  return (
    <Link
      href={paths.document(document.id)}
      className="group flex flex-col gap-3 rounded-[28px] glass p-3 transition hover:-translate-y-0.5"
    >
      <div className="relative aspect-[3/4] overflow-hidden rounded-[20px] bg-white/90 shadow-[0_8px_24px_-12px_rgb(0_0_0/0.5)]">
        {thumb ? (
          <img
            src={thumb}
            alt=""
            className="size-full object-cover object-top"
            draggable={false}
          />
        ) : (
          <div className="flex size-full flex-col justify-between bg-linear-to-b from-white to-slate-100 p-4 text-slate-500">
            <span className="line-clamp-4 font-serif text-lg leading-tight text-slate-700">
              {document.title}
            </span>
            <span className="text-xs">
              {locked.has(document.id)
                ? 'Protected with a password'
                : failed.has(document.id)
                  ? "Couldn't read this PDF"
                  : reading.has(document.id)
                    ? 'Reading…'
                    : 'PDF'}
            </span>
          </div>
        )}
        {progress > 0 && (
          <span
            aria-hidden="true"
            className="absolute inset-x-0 bottom-0 h-1 bg-black/10"
          >
            <span
              className="block h-full bg-orange-400"
              style={{ width: `${Math.min(100, progress * 100)}%` }}
            />
          </span>
        )}
      </div>
      <div className="min-w-0 px-1 pb-1">
        <p className="line-clamp-2 text-sm leading-snug font-medium">
          {document.title}
        </p>
        <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-fg-subtle">
          {started ? (
            <span>
              Page {document.lastPage} of {document.pages}
            </span>
          ) : (
            <span>
              {document.pages
                ? `${document.pages} ${document.pages === 1 ? 'page' : 'pages'}`
                : formatSize(document.size)}
            </span>
          )}
          {subject && (
            <span className="inline-flex min-w-0 items-center gap-1.5">
              <SubjectDot color={subject.color} className="size-2" />
              <span className="truncate">{subject.name}</span>
            </span>
          )}
        </p>
      </div>
    </Link>
  )
}
