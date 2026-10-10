import { Link } from 'wouter'
import { GlassCard } from '@/components/GlassCard'
import { InboxIcon } from '@/components/icons'
import { paths } from '@/lib/routes'
import { useInbox } from '../hooks/useInbox'

/** On the dashboard while something's waiting to be sorted. */
export function InboxNotice() {
  const count = useInbox().length
  if (count === 0) return null
  return (
    <GlassCard
      as={Link}
      href={paths.inbox}
      className="flex w-full items-center gap-3 px-5 py-4 transition hover:bg-tint sm:px-6"
    >
      <InboxIcon className="text-lg text-orange-300 light:text-orange-500" />
      <span className="flex-1 text-[15px]">
        {count} {count === 1 ? 'thing' : 'things'} in your inbox to sort
      </span>
      <span className="text-xs font-semibold text-fg-muted">Open</span>
    </GlassCard>
  )
}

/** The inbox count beside its name in the sidebar. */
export function InboxBadge() {
  const count = useInbox().length
  if (count === 0) return null
  return (
    <span className="ml-auto rounded-full bg-orange-400/20 px-2 py-0.5 text-[11px] font-semibold text-orange-200 tabular-nums light:text-orange-700">
      {count}
    </span>
  )
}
