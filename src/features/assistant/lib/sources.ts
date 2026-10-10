import { paths } from '@/lib/routes'
import type { SourceRef } from '../types'

/** Where a cited passage opens: its note, or its document at the page. */
export const sourceHref = (source: SourceRef) =>
  source.kind === 'note'
    ? paths.note(source.id)
    : paths.document(source.id, source.page ?? undefined)

/** "Lecture 5, p. 3" */
export const sourceLabel = (source: SourceRef) =>
  `${source.title}${source.page ? `, p. ${source.page}` : ''}`
