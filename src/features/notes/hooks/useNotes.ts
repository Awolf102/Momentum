import { useMemo } from 'react'
import { useStore } from '@/lib/store'
import { notes, sortNotes } from '../notes'
import type { Note } from '../types'

/** Every note: pinned first, then the most recently changed. */
export function useNotes(): Note[] {
  const all = useStore(notes)
  return useMemo(() => sortNotes(all), [all])
}
