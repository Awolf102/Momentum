import { Link } from 'wouter'
import { CardsIcon } from '@/components/icons'
import { paths } from '@/lib/routes'
import { useCards, useDue } from '../hooks/useCards'
import { describeWhen } from '../lib/format'

const plural = (count: number, one: string, many = `${one}s`) =>
  `${count} ${count === 1 ? one : many}`

/** On the dashboard, once there are cards: what's due today, a tap away. */
export function CardsDueCard() {
  const hasCards = useCards().length > 0
  const { counts, next, now } = useDue()
  if (!hasCards) return null
  const parts = [
    counts.learning && `${counts.learning} learning`,
    counts.review && `${plural(counts.review, 'review')}`,
    counts.new && `${counts.new} new`,
  ].filter(Boolean)
  return (
    <Link
      href={counts.total ? paths.study() : paths.cards}
      className="flex items-center gap-4 rounded-[28px] glass p-4 pr-5 transition hover:-translate-y-0.5"
    >
      <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-linear-to-br from-amber-300/25 to-orange-500/25 text-xl text-orange-300 ring-1 ring-orange-300/30 light:text-orange-500">
        <CardsIcon />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[11px] font-semibold tracking-[0.14em] text-fg-subtle uppercase">
          Cards
        </span>
        {counts.total ? (
          <>
            <span className="mt-0.5 block text-[15px] font-medium">
              {plural(counts.total, 'card')} to study today
            </span>
            <span className="block truncate text-xs text-fg-subtle">
              {parts.join(' · ')}
            </span>
          </>
        ) : (
          <>
            <span className="mt-0.5 block text-[15px] font-medium">
              Done for today
            </span>
            <span className="block truncate text-xs text-fg-subtle">
              {next ? `Next card ${describeWhen(next, now)}` : 'Nothing due'}
            </span>
          </>
        )}
      </span>
      {counts.total > 0 && (
        <span className="rounded-full bg-linear-to-br from-amber-300 to-orange-500 px-4 py-2 text-sm font-semibold text-orange-950 shadow-[0_10px_24px_-12px_rgb(249_115_22/0.8)]">
          Study
        </span>
      )}
    </Link>
  )
}
