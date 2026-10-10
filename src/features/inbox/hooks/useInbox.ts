import { useMemo } from 'react'
import { useStore } from '@/lib/store'
import { inboxItems } from '../items'
import type { InboxItem } from '../types'

/** What's in the inbox, newest first. */
export function useInbox(): InboxItem[] {
  const items = useStore(inboxItems)
  return useMemo(() => [...items].reverse(), [items])
}
