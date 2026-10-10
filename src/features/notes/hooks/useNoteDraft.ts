import { useCallback, useEffect, useRef, useState } from 'react'
import { notes, saveNote } from '../notes'
import type { Note } from '../types'

/** How long typing pauses before the body is saved. */
const SAVE_DELAY = 400

/**
 * A note being edited. The body saves itself shortly after you stop typing
 * (and whenever you leave); the title when you finish it, so a rename is
 * carried into other notes' links once, not on every keystroke.
 */
export function useNoteDraft(note: Note) {
  const { id } = note
  const [title, setTitle] = useState(note.title)
  const [body, setBody] = useState(note.body)

  // A change made elsewhere (another tab, a renamed link, a restored
  // backup) is taken in, unless you've changed that part since.
  const [seen, setSeen] = useState({ title: note.title, body: note.body })
  if (note.title !== seen.title || note.body !== seen.body) {
    setSeen({ title: note.title, body: note.body })
    if (title === seen.title) setTitle(note.title)
    if (body === seen.body) setBody(note.body)
  }

  const latest = useRef({ title, body })
  useEffect(() => {
    latest.current = { title, body }
  })

  useEffect(() => {
    if (body === notes.find(id)?.body) return
    const timer = window.setTimeout(
      () => void saveNote(id, { body }),
      SAVE_DELAY,
    )
    return () => window.clearTimeout(timer)
  }, [id, body])

  /** Saves anything not yet saved, now. */
  const flush = useCallback(() => {
    const stored = notes.find(id)
    if (!stored || stored.deletedAt) return
    const { title, body } = latest.current
    if (body !== stored.body || title.trim() !== stored.title)
      void saveNote(id, { title, body })
  }, [id])

  useEffect(() => {
    // Leaving the tab or closing it: save first.
    const onHide = () => document.visibilityState === 'hidden' && flush()
    document.addEventListener('visibilitychange', onHide)
    window.addEventListener('pagehide', flush)
    return () => {
      document.removeEventListener('visibilitychange', onHide)
      window.removeEventListener('pagehide', flush)
      flush()
    }
  }, [flush])

  /** Saves the title as typed (tidied). */
  function commitTitle() {
    const trimmed = title.trim()
    setTitle(trimmed)
    if (trimmed !== notes.find(id)?.title) void saveNote(id, { title: trimmed })
  }

  return { title, setTitle, commitTitle, body, setBody, flush }
}
