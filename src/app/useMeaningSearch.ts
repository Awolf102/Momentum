import { useEffect, useState } from 'react'
import type { MeaningSearch } from '@/lib/commands'

/**
 * Search by meaning for the palette, checked each time it opens (settings
 * may have changed). Null when embeddings aren't set up.
 */
export function useMeaningSearch(open: boolean): MeaningSearch | null {
  const [meaning, setMeaning] = useState<MeaningSearch | null>(null)
  useEffect(() => {
    if (!open) return
    let current = true
    import('@/features/embeddings')
      .then(({ meaningSearch }) => meaningSearch())
      .then(
        (found) => {
          if (current) setMeaning(found)
        },
        () => {},
      )
    return () => {
      current = false
    }
  }, [open])
  return meaning
}
