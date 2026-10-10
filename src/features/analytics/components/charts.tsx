import { useId, type ReactNode } from 'react'
import { cn } from '@/lib/cn'

/** One part of a column: a subject's minutes, the tasks done on time… */
export interface Segment {
  key: string
  value: number
  color: string
}

export interface ColumnData {
  key: string
  /** Under the column, when it's one of those labelled. */
  label: string
  /** What the column says, in words (for screen readers and on hover). */
  title: string
  segments: Segment[]
  /** Drawn fainter: still to come, or outside what's picked out. */
  faint?: boolean
}

const total = (segments: readonly Segment[]) =>
  segments.reduce((sum, segment) => sum + Math.max(0, segment.value), 0)

/**
 * Columns, each stacked from its segments, with some labelled underneath
 * and an optional dashed line across (a target).
 */
export function Columns({
  data,
  label,
  max,
  labelled = () => true,
  guide,
  className,
  height = 'h-40',
}: {
  data: readonly ColumnData[]
  label: string
  /** The value at the top; the tallest column's by default. */
  max?: number
  labelled?: (index: number) => boolean
  guide?: { value: number; label: string }
  className?: string
  height?: string
}) {
  const top =
    max ?? Math.max(1, ...data.map((column) => total(column.segments)))
  const columns = {
    gridTemplateColumns: `repeat(${data.length}, minmax(0, 1fr))`,
  }
  const gap = data.length > 16 ? 'gap-[2px] sm:gap-[3px]' : 'gap-1.5 sm:gap-2'
  return (
    <div className={className}>
      <div className={cn('relative', height)}>
        <ol
          aria-label={label}
          className={cn('grid h-full items-end', gap)}
          style={columns}
        >
          {data.map((column) => {
            const sum = total(column.segments)
            return (
              <li
                key={column.key}
                aria-label={column.title}
                title={column.title}
                className="flex h-full flex-col justify-end"
              >
                <span
                  className={cn(
                    'flex w-full flex-col-reverse overflow-hidden rounded-t-[5px]',
                    column.faint && 'opacity-35',
                  )}
                  style={{
                    height: sum ? `${Math.max(3, (sum / top) * 100)}%` : 3,
                  }}
                >
                  {sum ? (
                    column.segments
                      .filter((segment) => segment.value > 0)
                      .map((segment) => (
                        <span
                          key={segment.key}
                          className="block w-full shrink-0"
                          style={{
                            height: `${(segment.value / sum) * 100}%`,
                            background: segment.color,
                          }}
                        />
                      ))
                  ) : (
                    <span className="block h-full w-full bg-tint" />
                  )}
                </span>
              </li>
            )
          })}
        </ol>
        {guide && (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 border-t border-dashed border-fg-muted/50"
            style={{ bottom: `${Math.min(100, (guide.value / top) * 100)}%` }}
          >
            <span className="absolute right-0 bottom-1 rounded-full bg-black/25 px-1.5 text-[10px] font-semibold text-fg-muted light:bg-white/60">
              {guide.label}
            </span>
          </div>
        )}
      </div>
      <div
        aria-hidden
        className={cn('mt-1.5 grid text-[10px] text-fg-subtle', gap)}
        style={columns}
      >
        {data.map((column, index) => (
          <span
            key={column.key}
            className={cn(
              'flex min-w-0',
              // Labels wider than their columns stay inside the chart.
              data.length <= 12 || (index > 0 && index < data.length - 1)
                ? 'justify-center'
                : index === 0
                  ? 'justify-start'
                  : 'justify-end',
            )}
          >
            <span className="shrink-0 whitespace-nowrap tabular-nums">
              {labelled(index) ? column.label : ''}
            </span>
          </span>
        ))}
      </div>
    </div>
  )
}

/**
 * The streak's height over time: up a step each day of a run, down to
 * nothing when it breaks.
 */
export function StreakArea({
  heights,
  label,
  start,
  end,
  className,
}: {
  heights: readonly number[]
  label: string
  /** Under the chart, at either end. */
  start: ReactNode
  end: ReactNode
  className?: string
}) {
  const id = useId()
  const top = Math.max(1, ...heights)
  const count = heights.length
  let area = `M0 ${top}`
  let line = ''
  heights.forEach((height, index) => {
    const y = top - height
    area += ` L${index} ${y} L${index + 1} ${y}`
    line += `${index ? ' L' : 'M'}${index} ${y} L${index + 1} ${y}`
  })
  area += ` L${count} ${top} Z`
  return (
    <div className={className}>
      <div className="relative h-36">
        <svg
          viewBox={`0 0 ${Math.max(1, count)} ${top}`}
          preserveAspectRatio="none"
          role="img"
          aria-label={label}
          className="size-full overflow-visible"
        >
          <defs>
            <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
              <stop
                offset="0"
                stopColor="oklch(0.8 0.15 70)"
                stopOpacity="0.55"
              />
              <stop
                offset="1"
                stopColor="oklch(0.7 0.17 45)"
                stopOpacity="0.06"
              />
            </linearGradient>
          </defs>
          <path d={area} fill={`url(#${CSS.escape(id)})`} />
          <path
            d={line}
            fill="none"
            stroke="oklch(0.82 0.15 70)"
            strokeWidth={1.75}
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
        <span
          aria-hidden
          className="absolute top-0 left-0 -translate-y-1/2 rounded-full bg-black/25 px-1.5 text-[10px] font-semibold text-fg-muted light:bg-white/60"
        >
          {top} {top === 1 ? 'day' : 'days'}
        </span>
      </div>
      <div
        aria-hidden
        className="mt-1.5 flex justify-between text-[10px] text-fg-subtle"
      >
        <span>{start}</span>
        <span>{end}</span>
      </div>
    </div>
  )
}

/** A row of numbers under a section's title. */
export function Facts({
  items,
  className,
}: {
  items: ReadonlyArray<readonly [string, ReactNode, ReactNode?]>
  className?: string
}) {
  return (
    <dl
      className={cn(
        // Four across where there's room; two in a half-width card.
        'grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-2',
        className,
      )}
    >
      {items.map(([name, value, hint]) => (
        <div key={name} className="rounded-2xl bg-tint px-3 py-2.5">
          <dt className="text-[11px] font-semibold tracking-[0.1em] text-fg-subtle uppercase">
            {name}
          </dt>
          <dd className="mt-0.5 font-serif text-2xl leading-tight tabular-nums">
            {value}
          </dd>
          {hint && <dd className="text-xs text-fg-muted">{hint}</dd>}
        </div>
      ))}
    </dl>
  )
}

/** A key to a chart's colours. */
export function Legend({
  items,
}: {
  items: ReadonlyArray<{ label: string; color: string }>
}) {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-fg-muted">
      {items.map((item) => (
        <li key={item.label} className="flex items-center gap-1.5">
          <span
            aria-hidden
            className="size-2.5 rounded-[3px]"
            style={{ background: item.color }}
          />
          {item.label}
        </li>
      ))}
    </ul>
  )
}
