import { LibraryIcon, NoteIcon, SparkleIcon } from '@/components/icons'
import { checkLocalModel, localModelStore, modelStored } from '@/features/ai'
import { documents } from '@/features/library'
import { notes } from '@/features/notes'
import type { MarkedText, MeaningSearch, PaletteResult } from '@/lib/commands'
import { storeRegistry } from '@/lib/persistentStore'
import { navigate, paths } from '@/lib/routes'
import { currentTarget, startAutoIndex } from './indexer'
import { sentences } from './lib/chunk'
import { searchByMeaning } from './search'
import type { MeaningHit } from './types'

const SECTION = 'By meaning'
const SNIPPET_CHARS = 180

const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/**
 * A line from a passage for the palette: from the first sentence that shares
 * a word with the search (else the start), with those words marked.
 */
export function passageSnippet(text: string, query: string): MarkedText[] {
  const words = [
    ...new Set(query.toLowerCase().match(/[\p{L}\p{N}]{4,}/gu) ?? []),
  ]
  const pattern = words.length
    ? new RegExp(`(?<![\\p{L}\\p{N}])(${words.map(escape).join('|')})`, 'giu')
    : null
  const all = sentences(text)
  const start = Math.max(
    0,
    pattern
      ? all.findIndex((sentence) => {
          pattern.lastIndex = 0
          return pattern.test(sentence)
        })
      : 0,
  )
  let line = all.slice(start).join(' ')
  if (line.length > SNIPPET_CHARS)
    line = `${line.slice(0, SNIPPET_CHARS).replace(/\s+\S*$/, '')}…`
  if (start > 0) line = `…${line}`
  if (!pattern) return [{ text: line, match: false }]
  // `test` above moved it on; matching starts from here.
  pattern.lastIndex = 0
  const parts: MarkedText[] = []
  let last = 0
  for (const match of line.matchAll(pattern)) {
    const at = match.index ?? 0
    if (at > last) parts.push({ text: line.slice(last, at), match: false })
    parts.push({ text: match[0], match: true })
    last = at + match[0].length
  }
  if (last < line.length) parts.push({ text: line.slice(last), match: false })
  return parts
}

function toResult(hit: MeaningHit, query: string): PaletteResult | null {
  const snippet = passageSnippet(hit.text, query)
  if (hit.kind === 'note') {
    const note = notes.find(hit.id)
    if (!note || note.deletedAt) return null
    return {
      id: `meaning:${hit.key}`,
      section: SECTION,
      icon: <NoteIcon />,
      title: [{ text: note.title || 'Untitled', match: false }],
      snippet,
      opens: hit.key,
      run: () => navigate(paths.note(note.id)),
    }
  }
  const document = documents.find(hit.id)
  if (!document || document.deletedAt) return null
  return {
    id: `meaning:${hit.key}:${hit.page ?? ''}`,
    section: SECTION,
    icon: <LibraryIcon />,
    title: [{ text: document.title, match: false }],
    snippet,
    detail: hit.page ? `p. ${hit.page}` : undefined,
    opens: hit.page ? `${hit.key}#${hit.page}` : hit.key,
    run: () => navigate(paths.document(document.id, hit.page ?? undefined)),
  }
}

/** Search by meaning for the palette, or null when it isn't set up. */
export async function meaningSearch(): Promise<MeaningSearch | null> {
  await storeRegistry.settled()
  const target = currentTarget()
  if (!target) return null
  if (target.local) {
    await checkLocalModel(target.model)
    // Not downloaded yet: that's a choice for Settings, not the palette.
    if (!modelStored(localModelStore.get())) return null
  }
  startAutoIndex()
  return {
    mode: target.local ? 'auto' : 'ask',
    sendsTo: target.local ? undefined : target.label,
    async find(query, signal) {
      const { hits, searched } = await searchByMeaning(query, signal)
      if (searched === 0)
        return [
          {
            id: 'meaning:empty',
            section: SECTION,
            icon: <SparkleIcon />,
            title: [{ text: 'Build the search index first', match: false }],
            snippet: [
              {
                text: 'Notes and documents are searched by meaning once they’re indexed, in Settings → AI.',
                match: false,
              },
            ],
            run: () => navigate(paths.settings('ai')),
          },
        ]
      return hits
        .map((hit) => toResult(hit, query))
        .filter((result) => result !== null)
    },
  }
}
