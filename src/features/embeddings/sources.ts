import {
  documents,
  documentTexts,
  loadDocumentTexts,
  onDocumentTextsChange,
} from '@/features/library'
import { isEmptyNote, notes, plainLines } from '@/features/notes'
import {
  CHUNK_CHARS,
  chunkSegments,
  letterCount,
  type Chunk,
  type Segment,
} from './lib/chunk'
import { hashText } from './lib/plan'
import type { Source } from './types'

/** Bump when chunking changes, so everything is indexed again. */
const CHUNKING_VERSION = 1

function makeSource(
  kind: Source['kind'],
  id: string,
  title: string,
  segments: Segment[],
): Source {
  const body = segments.map((segment) => segment.text).join('\n')
  return {
    key: `${kind}:${id}`,
    kind,
    id,
    title,
    segments,
    hash: hashText(
      `${CHUNKING_VERSION}\n${title}\n${segments.map((segment) => `${segment.page ?? ''}\u0001${segment.text}`).join('\u0002')}`,
    ),
    chars: title.length + body.length,
  }
}

// Worked out once per version of a record (records are replaced on edit;
// a document's pages are replaced when read again).
const made = new WeakMap<object, { title: string; source: Source }>()
function memo(owner: object, title: string, make: () => Source): Source {
  const cached = made.get(owner)
  if (cached?.title === title) return cached.source
  const source = make()
  made.set(owner, { title, source })
  return source
}

/** Every note and document that has text, as the index should see it. */
export async function currentSources(): Promise<Source[]> {
  await loadDocumentTexts().catch(() => {})
  const sources: Source[] = []
  for (const note of notes.get()) {
    if (isEmptyNote(note)) continue
    sources.push(
      memo(note, note.title, () =>
        makeSource('note', note.id, note.title.trim() || 'Untitled', [
          {
            page: null,
            text: plainLines(note.body, { code: 'keep' }).join('\n'),
          },
        ]),
      ),
    )
  }
  const texts = documentTexts()
  for (const document of documents.get()) {
    const pages = texts.get(document.id)
    // Not read yet, or a scan with no text in it.
    if (!pages?.some((page) => page.trim())) continue
    sources.push(
      memo(pages, document.title, () =>
        makeSource(
          'document',
          document.id,
          document.title,
          pages.map((text, index) => ({ page: index + 1, text })),
        ),
      ),
    )
  }
  return sources
}

/**
 * A source's passages. A short note that makes no passage of its own still
 * gets one, so it can be found by its title.
 */
export function chunkSource(source: Source): Chunk[] {
  const chunks = chunkSegments(source.segments)
  if (chunks.length > 0 || source.kind !== 'note') return chunks
  const text = source.segments
    .map((segment) => segment.text)
    .join(' ')
    .slice(0, CHUNK_CHARS)
  return letterCount(source.title + text) > 0 ? [{ page: null, text }] : []
}

/** What gets embedded for a passage: its source's title, then the passage. */
export function passageText(
  source: Pick<Source, 'title'>,
  chunk: Chunk,
  prefix = '',
): string {
  return `${prefix}${source.title}\n\n${chunk.text}`.trim()
}

/** Calls `listener` when notes or documents (or their text) change. */
export function onSourcesChange(listener: () => void): () => void {
  const stops = [
    notes.subscribe(listener),
    documents.subscribe(listener),
    onDocumentTextsChange(listener),
  ]
  return () => {
    for (const stop of stops) stop()
  }
}
