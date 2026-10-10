import { useMemo } from 'react'
import { Link } from 'wouter'
import { GlassCard } from '@/components/GlassCard'
import { LinkIcon } from '@/components/icons'
import { paths } from '@/lib/routes'
import { useStore } from '@/lib/store'
import { excerpt } from '../lib/excerpt'
import { backlinks } from '../lib/links'
import { notes } from '../notes'

/** The notes that link here, each with the line that does. */
export function Backlinks({ title }: { title: string }) {
  const all = useStore(notes)
  const linked = useMemo(() => {
    const byId = new Map(all.map((note) => [note.id, note]))
    return backlinks(title, all).map(({ id, context }) => ({
      id,
      title: byId.get(id)?.title || 'Untitled',
      context: excerpt(context, 140),
    }))
  }, [all, title])
  if (linked.length === 0) return null
  return (
    <GlassCard className="px-5 py-4 sm:px-6">
      <h2 className="flex items-center gap-2 text-xs font-semibold tracking-[0.2em] text-fg-subtle uppercase">
        <LinkIcon className="text-sm" /> Linked from
      </h2>
      <ul className="mt-1 divide-y divide-line">
        {linked.map((link) => (
          <li key={link.id}>
            <Link
              href={paths.note(link.id)}
              className="group block py-3 transition"
            >
              <span className="font-medium group-hover:underline group-hover:underline-offset-4">
                {link.title}
              </span>
              {link.context && (
                <span className="mt-0.5 line-clamp-2 text-sm leading-relaxed text-fg-muted">
                  {link.context}
                </span>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </GlassCard>
  )
}
