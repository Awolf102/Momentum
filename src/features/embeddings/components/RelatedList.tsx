import { useEffect, useState } from 'react'
import { Link } from 'wouter'
import { GlassCard } from '@/components/GlassCard'
import { LibraryIcon, NoteIcon, SparkleIcon } from '@/components/icons'
import { documents } from '@/features/library'
import { notes } from '@/features/notes'
import { useStore } from '@/lib/store'
import { paths } from '@/lib/routes'
import { startAutoIndex } from '../indexer'
import { indexVersionStore, relatedTo } from '../search'
import type { MeaningHit } from '../types'

/**
 * Notes and document pages close in meaning to a note, from the search
 * index: nothing is sent to find them. Shows nothing until the note is
 * indexed.
 */
export function RelatedList({ noteId }: { noteId: string }) {
  const version = useStore(indexVersionStore)
  const [found, setFound] = useState<{ id: string; hits: MeaningHit[] }>({
    id: '',
    hits: [],
  })

  useEffect(() => startAutoIndex(), [])

  useEffect(() => {
    let current = true
    relatedTo(`note:${noteId}`).then(
      (hits) => current && setFound({ id: noteId, hits }),
      () => {},
    )
    return () => {
      current = false
    }
  }, [noteId, version])

  const items = (found.id === noteId ? found.hits : []).flatMap((hit) => {
    if (hit.kind === 'note') {
      const note = notes.find(hit.id)
      if (!note || note.deletedAt) return []
      return [
        {
          hit,
          href: paths.note(note.id),
          title: note.title || 'Untitled',
          detail: '',
          icon: <NoteIcon />,
        },
      ]
    }
    const document = documents.find(hit.id)
    if (!document || document.deletedAt) return []
    return [
      {
        hit,
        href: paths.document(document.id, hit.page ?? undefined),
        title: document.title,
        detail: hit.page ? `p. ${hit.page}` : '',
        icon: <LibraryIcon />,
      },
    ]
  })
  if (items.length === 0) return null

  return (
    <GlassCard className="px-5 py-4 sm:px-6">
      <h2 className="flex items-center gap-2 text-xs font-semibold tracking-[0.2em] text-fg-subtle uppercase">
        <SparkleIcon className="text-sm" /> Related
      </h2>
      <ul className="mt-1 divide-y divide-line">
        {items.map((item) => (
          <li key={`${item.hit.key}#${item.hit.page ?? ''}`}>
            <Link href={item.href} className="group flex gap-3 py-3 transition">
              <span className="mt-0.5 shrink-0 text-base text-fg-subtle">
                {item.icon}
              </span>
              <span className="min-w-0 flex-1">
                <span className="font-medium group-hover:underline group-hover:underline-offset-4">
                  {item.title}
                </span>
                {item.detail && (
                  <span className="ml-2 text-xs text-fg-subtle">
                    {item.detail}
                  </span>
                )}
                <span className="mt-0.5 line-clamp-2 text-sm leading-relaxed text-fg-muted">
                  {item.hit.text}
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </GlassCard>
  )
}
