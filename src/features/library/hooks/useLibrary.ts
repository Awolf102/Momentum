import { useEffect, useMemo, useState } from 'react'
import { useStore } from '@/lib/store'
import { documents } from '../documents'
import { loadThumb } from '../files'
import { highlights } from '../highlights'
import { readingOrder } from '../lib/rects'
import type { Highlight, LibraryDocument } from '../types'

/** The library: the documents opened most recently first, then the newest. */
export function useDocuments(): LibraryDocument[] {
  const all = useStore(documents)
  return useMemo(
    () =>
      [...all].sort((a, b) =>
        (b.lastOpenedAt ?? b.createdAt).localeCompare(
          a.lastOpenedAt ?? a.createdAt,
        ),
      ),
    [all],
  )
}

/** A document's highlights, in reading order. */
export function useHighlights(documentId: string): Highlight[] {
  const all = useStore(highlights)
  return useMemo(
    () =>
      readingOrder(
        all.filter((highlight) => highlight.documentId === documentId),
      ),
    [all, documentId],
  )
}

/**
 * The picture of a document's first page, as a URL for an <img>. `ready`
 * (the page count arriving) is the cue to look again after reading.
 */
export function useThumb(id: string, ready: boolean): string | null {
  const [thumb, setThumb] = useState<{ id: string; url: string } | null>(null)
  useEffect(() => {
    if (!ready) return
    let url: string | null = null
    let current = true
    void loadThumb(id).then((blob) => {
      if (!current || !blob) return
      url = URL.createObjectURL(blob)
      setThumb({ id, url })
    })
    return () => {
      current = false
      if (url) URL.revokeObjectURL(url)
    }
  }, [id, ready])
  return thumb?.id === id ? thumb.url : null
}
