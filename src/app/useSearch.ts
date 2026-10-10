import { useEffect, useState } from 'react'
import type { PaletteResult } from '@/lib/commands'

type Search = (query: string) => readonly PaletteResult[]
const nothing: Search = () => []

/**
 * Search for the palette, loaded the first time the palette opens (it isn't
 * needed before). Until then, and if it can't load, only commands are found.
 */
export function useSearch(open: boolean): Search {
  const [search, setSearch] = useState<Search>(() => nothing)
  useEffect(() => {
    if (!open || search !== nothing) return
    let current = true
    import('@/features/search').then(
      ({ searchEverything }) => current && setSearch(() => searchEverything),
      () => {},
    )
    return () => {
      current = false
    }
  }, [open, search])
  return search
}
