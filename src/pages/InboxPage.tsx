import { useEffect } from 'react'
import { InboxIcon } from '@/components/icons'
import { capture, fromShare, useInbox } from '@/features/inbox'
import { CaptureField, InboxList } from '@/features/inbox/page'
import { navigate, paths } from '@/lib/routes'
import { toast } from '@/lib/toast'

/** Share-target visits already handled, so a re-render can't save twice. */
const handled = new Set<string>()

/**
 * Something shared from another app arrives as /inbox?title=…&text=…&url=…
 * (the PWA share target). It's saved, and the address tidied.
 */
function useSharedItem() {
  useEffect(() => {
    const { search } = window.location
    if (!search || handled.has(search)) return
    handled.add(search)
    const params = new URLSearchParams(search)
    const shared = fromShare(params)
    navigate(paths.inbox, { replace: true })
    if (!shared) return
    void capture(shared.text, { url: shared.url, source: 'shared' }).then(
      (item) =>
        item &&
        toast({
          id: 'shared',
          icon: <InboxIcon className="text-orange-300" />,
          title: 'Saved to your inbox',
          duration: 2500,
        }),
    )
  }, [])
}

export default function InboxPage() {
  useSharedItem()
  const items = useInbox()
  const wantsCapture =
    new URLSearchParams(window.location.search).get('capture') === '1'
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col pt-2 pb-8 sm:pt-6 lg:pt-2">
      <h1 className="font-serif text-5xl leading-none tracking-tight text-shadow-soft sm:text-6xl">
        Inbox
      </h1>
      <p className="mt-3 text-[15px] text-fg-muted text-shadow-soft">
        {items.length === 0
          ? 'Capture now, sort later.'
          : `${items.length} to sort. Make each a task or a note, add it to today's log, or let it go.`}
      </p>
      <div className="mt-6 flex flex-col gap-4">
        <div className="rounded-[28px] glass p-2">
          <CaptureField autoFocus={wantsCapture} />
        </div>
        <InboxList items={items} />
      </div>
    </div>
  )
}
