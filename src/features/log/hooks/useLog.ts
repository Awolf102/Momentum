import { useCallback, useEffect, useMemo, useState } from 'react'
import type { DateKey } from '@/lib/date'
import { useStore } from '@/lib/store'
import { logEntries } from '../entries'
import { editorsOnScreen, lineRequestStore } from '../store'

/** Every day's line, by day. */
export function useLogLines(): ReadonlyMap<DateKey, string> {
  const entries = useStore(logEntries)
  return useMemo(
    () => new Map(entries.map((entry) => [entry.day, entry.text])),
    [entries],
  )
}

/** Opens this day's editor when someone asks to write its line (L, ⌘K). */
export function useLineRequests(day: DateKey, open: () => void): void {
  useEffect(() => {
    editorsOnScreen.set(day, (editorsOnScreen.get(day) ?? 0) + 1)
    const take = () => {
      if (lineRequestStore.get() !== day) return
      lineRequestStore.set(null)
      open()
    }
    take()
    const unsubscribe = lineRequestStore.subscribe(take)
    return () => {
      unsubscribe()
      const count = (editorsOnScreen.get(day) ?? 1) - 1
      if (count > 0) editorsOnScreen.set(day, count)
      else editorsOnScreen.delete(day)
    }
  }, [day, open])
}

/** Editing state for a day's line, opened by a tap or by L / ⌘K. */
export function useLineEditing(day: DateKey) {
  const [editing, setEditing] = useState(false)
  const open = useCallback(() => setEditing(true), [])
  const close = useCallback(() => setEditing(false), [])
  useLineRequests(day, open)
  return { editing, open, close }
}
