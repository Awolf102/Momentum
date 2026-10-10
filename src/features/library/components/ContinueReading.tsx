import { Link } from 'wouter'
import { BookIcon } from '@/components/icons'
import { paths } from '@/lib/routes'
import { useToday } from '@/lib/useToday'
import { daysBetween, toDateKey } from '@/lib/date'
import { useDocuments, useThumb } from '../hooks/useLibrary'

/** How long a document stays "being read" after you last opened it. */
const RECENT_DAYS = 14

/** On the dashboard: the document you're partway through, a tap away. */
export function ContinueReading() {
  const today = useToday()
  const document = useDocuments().find(
    (each) =>
      each.lastOpenedAt !== null &&
      each.pages !== null &&
      each.lastPage < each.pages &&
      daysBetween(toDateKey(new Date(each.lastOpenedAt)), today) <= RECENT_DAYS,
  )
  const thumb = useThumb(document?.id ?? '', Boolean(document))
  if (!document) return null
  const progress = document.lastPage / (document.pages ?? 1)
  return (
    <Link
      href={paths.document(document.id)}
      className="flex items-center gap-4 rounded-[28px] glass p-3 pr-5 transition hover:-translate-y-0.5"
    >
      <span className="h-16 w-12 shrink-0 overflow-hidden rounded-lg bg-white/90 shadow-[0_6px_16px_-8px_rgb(0_0_0/0.5)]">
        {thumb && (
          <img
            src={thumb}
            alt=""
            className="size-full object-cover object-top"
          />
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5 text-[11px] font-semibold tracking-[0.14em] text-fg-subtle uppercase">
          <BookIcon /> Continue reading
        </span>
        <span className="mt-0.5 block truncate text-[15px] font-medium">
          {document.title}
        </span>
        <span className="mt-1.5 flex items-center gap-3 text-xs text-fg-subtle tabular-nums">
          <span className="h-1 flex-1 overflow-hidden rounded-full bg-tint">
            <span
              className="block h-full rounded-full bg-orange-400"
              style={{ width: `${Math.min(100, progress * 100)}%` }}
            />
          </span>
          Page {document.lastPage} of {document.pages}
        </span>
      </span>
    </Link>
  )
}
