import type { ReactNode } from 'react'
import { useLocation } from 'wouter'
import { GlassCard } from '@/components/GlassCard'
import { SegmentedControl } from '@/components/SegmentedControl'
import { SUBJECT_COLORS, subjectsStore } from '@/features/subjects'
import { cn } from '@/lib/cn'
import { addDays, formatDateKey, type DateKey } from '@/lib/date'
import { formatMinutes } from '@/lib/duration'
import { paths } from '@/lib/routes'
import { useStore } from '@/lib/store'
import { useAnalytics, type Analytics } from '../hooks/useAnalytics'
import { recallRate } from '../lib/cards'
import { daysIn, type Bucket, type Period, type Range } from '../lib/period'
import { completionRate } from '../lib/tasks'
import { Columns, Facts, Legend, StreakArea, type ColumnData } from './charts'

const PERIOD_NAMES: Record<Period, string> = {
  month: '4 weeks',
  quarter: '3 months',
  year: '12 months',
}

const heading =
  'text-xs font-semibold tracking-[0.14em] text-fg-subtle uppercase'
const FOCUS = 'linear-gradient(to top, oklch(0.82 0.15 80), oklch(0.7 0.18 45))'
const QUIET = 'oklch(0.88 0.06 80 / 0.42)'
const NO_SUBJECT = 'oklch(0.7 0.02 260)'
const ON_TIME = 'oklch(0.76 0.13 160)'
const LATE = 'oklch(0.82 0.14 80)'
const OPEN = 'oklch(0.72 0.15 15)'
const RECALL = 'oklch(0.75 0.12 230)'

const percent = (share: number | null) =>
  share === null ? '–' : `${Math.round(share * 100)}%`
const plural = (count: number, one: string, many = `${one}s`) =>
  `${count} ${count === 1 ? one : many}`

/** A column's label and its description, by the period's unit. */
function describe(range: Range, bucket: Bucket, index: number) {
  const { unit, buckets } = range
  if (unit === 'day')
    return {
      label: formatDateKey(bucket.start, { day: 'numeric', month: 'short' }),
      title: formatDateKey(bucket.start, {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
      }),
      labelled: (buckets.length - 1 - index) % 7 === 0,
    }
  if (unit === 'week')
    return {
      label: formatDateKey(bucket.start, { day: 'numeric', month: 'short' }),
      title: `Week of ${formatDateKey(bucket.start, { day: 'numeric', month: 'short' })}`,
      labelled: (buckets.length - 1 - index) % 4 === 0,
    }
  return {
    label: formatDateKey(bucket.start, { month: 'narrow' }),
    title: formatDateKey(bucket.start, { month: 'long', year: 'numeric' }),
    labelled: true,
  }
}

const hourFormat = new Intl.DateTimeFormat(undefined, { hour: 'numeric' })
// Hours past midnight (24, 25) fall on the next day, so a range can wrap.
const atHour = (hour: number) =>
  new Date(2026, 0, 1 + Math.floor(hour / 24), hour % 24)
/** "9–11 am", in the way this device writes times. */
function hourRange(start: number, end: number): string {
  const to = end <= start ? end + 24 : end
  try {
    return hourFormat.formatRange(atHour(start), atHour(to))
  } catch {
    return `${hourFormat.format(atHour(start))}–${hourFormat.format(atHour(to))}`
  }
}

function Section({
  title,
  children,
  className,
}: {
  title: string
  children: ReactNode
  className?: string
}) {
  return (
    <GlassCard className={cn('p-5 sm:p-6', className)}>
      <h2 className={heading}>{title}</h2>
      <div className="mt-4 space-y-4">{children}</div>
    </GlassCard>
  )
}

function Tile({
  name,
  value,
  hint,
  className,
}: {
  name: string
  value: string
  hint: string
  className?: string
}) {
  return (
    <GlassCard className={cn('px-4 py-3.5 sm:px-5 sm:py-4', className)}>
      <p className="text-[11px] font-semibold tracking-[0.12em] text-fg-subtle uppercase">
        {name}
      </p>
      <p className="mt-1.5 font-serif text-3xl leading-none tabular-nums sm:text-4xl">
        {value}
      </p>
      <p className="mt-1.5 text-xs text-fg-muted">{hint}</p>
    </GlassCard>
  )
}

const Empty = ({ children }: { children: ReactNode }) => (
  <p className="text-sm text-fg-muted">{children}</p>
)

/** Focus time, the best hours, streaks, tasks and cards over a period. */
export function AnalyticsView({ period }: { period: Period }) {
  const [, navigate] = useLocation()
  const data = useAnalytics(period)
  const { range } = data
  const within = `the last ${PERIOD_NAMES[period]}`
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 pt-2 pb-8 sm:gap-5 sm:pt-6 lg:pt-2">
      <div>
        <h1 className="font-serif text-5xl leading-none tracking-tight text-shadow-soft sm:text-6xl">
          Analytics
        </h1>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-lg font-semibold text-shadow-soft">
            {formatDateKey(range.from, { day: 'numeric', month: 'long' })} –{' '}
            {formatDateKey(range.to, { day: 'numeric', month: 'long' })}
          </p>
          {/* The options share its width, so give it room for each. */}
          <div className="w-full sm:w-80">
            <SegmentedControl
              label="Period"
              value={period}
              options={(Object.keys(PERIOD_NAMES) as Period[]).map((value) => ({
                value,
                label: PERIOD_NAMES[value],
              }))}
              onChange={(value) => navigate(paths.analytics(value))}
            />
          </div>
        </div>
      </div>
      <Tiles data={data} />
      <FocusSection data={data} within={within} />
      <div className="grid gap-4 sm:gap-5 lg:grid-cols-2">
        <HoursSection data={data} within={within} />
        <StreakSection data={data} />
      </div>
      <div className="grid gap-4 sm:gap-5 lg:grid-cols-2">
        <TasksSection data={data} within={within} />
        <CardsSection data={data} within={within} />
      </div>
      <p className="text-center text-xs text-fg-subtle">
        Worked out on this device from what’s saved here. Nothing is sent
        anywhere.
      </p>
    </div>
  )
}

function Tiles({ data }: { data: Analytics }) {
  const { focus, streaks, tasks, cards, range } = data
  const minutes = focus.bySubject.reduce((sum, each) => sum + each.minutes, 0)
  const rate = completionRate(tasks.total)
  const recall = cards && recallRate(cards.total)
  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-5">
      <Tile
        name="Focus"
        value={formatMinutes(minutes)}
        hint={
          minutes
            ? `${formatMinutes(Math.round(minutes / daysIn(range)))} a day on average`
            : 'No sessions yet'
        }
      />
      <Tile
        name="Best hours"
        value={focus.best ? hourRange(focus.best.start, focus.best.end) : '–'}
        hint={
          focus.best
            ? `${Math.round(focus.best.share * 100)}% of your focus`
            : 'Once you’ve focused'
        }
      />
      <Tile
        name="Streak"
        value={plural(streaks.summary.current, 'day')}
        hint={`Longest ${plural(streaks.history.longest?.days ?? 0, 'day')}`}
      />
      <Tile
        name="Tasks done"
        value={percent(rate)}
        hint={
          tasks.total.due
            ? `${tasks.total.onTime + tasks.total.late} of ${tasks.total.due} due`
            : 'None were due'
        }
      />
      <Tile
        className="col-span-2 lg:col-span-1"
        name="Card recall"
        value={cards ? percent(recall ?? null) : '…'}
        hint={
          cards
            ? cards.total.reviewed
              ? `Aiming for ${Math.round(cards.target * 100)}%`
              : 'No reviews due'
            : 'Reading the log'
        }
      />
    </div>
  )
}

function FocusSection({ data, within }: { data: Analytics; within: string }) {
  const { subjects } = useStore(subjectsStore)
  const { focus, range, today } = data
  const total = focus.bySubject.reduce((sum, each) => sum + each.minutes, 0)
  const colorOf = (id: string) => {
    const subject = subjects.find((each) => each.id === id)
    return subject ? SUBJECT_COLORS[subject.color] : NO_SUBJECT
  }
  const nameOf = (id: string | null) =>
    (id && subjects.find((each) => each.id === id)?.name) || 'No subject'
  const columns: ColumnData[] = range.buckets.map((bucket, index) => {
    const { label, title } = describe(range, bucket, index)
    const column = focus.byBucket[index]
    return {
      key: bucket.start,
      label,
      title: `${title}: ${formatMinutes(column.minutes)}`,
      segments: [...column.bySubject].map(([id, minutes]) => ({
        key: id || 'none',
        value: minutes,
        color: colorOf(id),
      })),
      faint: bucket.start > today,
    }
  })
  return (
    <Section title="Focus by subject">
      {total === 0 ? (
        <Empty>No focus sessions in {within}.</Empty>
      ) : (
        <>
          <Columns
            data={columns}
            label={`Focus over ${within}`}
            labelled={(index) =>
              describe(range, range.buckets[index], index).labelled
            }
          />
          <ul className="space-y-2" aria-label="Focus by subject">
            {focus.bySubject.map((each) => (
              <li
                key={each.subjectId ?? 'none'}
                className="flex items-center gap-3 text-sm"
              >
                <span
                  aria-hidden
                  className="size-2.5 shrink-0 rounded-full"
                  style={{ background: colorOf(each.subjectId ?? '') }}
                />
                <span className="w-24 shrink-0 truncate sm:w-40">
                  {nameOf(each.subjectId)}
                </span>
                <span className="h-2 flex-1 overflow-hidden rounded-full bg-tint">
                  <span
                    className="block h-full rounded-full"
                    style={{
                      width: `${(each.minutes / total) * 100}%`,
                      background: colorOf(each.subjectId ?? ''),
                    }}
                  />
                </span>
                <span className="w-[4.75rem] shrink-0 text-right text-xs whitespace-nowrap text-fg-muted tabular-nums">
                  {formatMinutes(each.minutes)}
                </span>
                <span className="w-9 shrink-0 text-right text-xs text-fg-subtle tabular-nums">
                  {Math.round((each.minutes / total) * 100)}%
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </Section>
  )
}

const WEEKDAYS: DateKey[] = Array.from({ length: 7 }, (_, index) =>
  addDays('2026-10-05', index),
) // a Monday, then the week

function HoursSection({ data, within }: { data: Analytics; within: string }) {
  const { focus } = data
  const best = focus.best
  const inBest = (hour: number) =>
    best !== null &&
    (hour - best.start + 24) % 24 < (best.end - best.start + 24) % 24
  const hours: ColumnData[] = focus.byHour.map((minutes, hour) => ({
    key: String(hour),
    label: hourFormat.format(atHour(hour)),
    title: `${hourRange(hour, hour + 1)}: ${formatMinutes(Math.round(minutes))}`,
    segments: [
      { key: 'focus', value: minutes, color: inBest(hour) ? FOCUS : QUIET },
    ],
  }))
  const weekdays: ColumnData[] = focus.byWeekday.map((minutes, index) => ({
    key: WEEKDAYS[index],
    label: formatDateKey(WEEKDAYS[index], { weekday: 'narrow' }),
    title: `${formatDateKey(WEEKDAYS[index], { weekday: 'long' })}: ${formatMinutes(minutes)}`,
    segments: [{ key: 'focus', value: minutes, color: FOCUS }],
  }))
  return (
    <Section title="Best hours">
      {!best ? (
        <Empty>No focus sessions in {within}.</Empty>
      ) : (
        <>
          <p className="text-[15px] leading-relaxed">
            You focus most from{' '}
            <strong>{hourRange(best.start, best.end)}</strong>:{' '}
            {Math.round(best.share * 100)}% of your focus in {within}.
          </p>
          <Columns
            data={hours}
            label="Focus in each hour of the day"
            labelled={(hour) => hour % 6 === 0}
            height="h-32"
          />
          <div>
            <h3 className="mb-2 text-xs font-semibold text-fg-muted">
              By day of the week
            </h3>
            <Columns
              data={weekdays}
              label="Focus on each day of the week"
              height="h-20"
            />
          </div>
        </>
      )}
    </Section>
  )
}

function StreakSection({ data }: { data: Analytics }) {
  const { streaks, range } = data
  const { history, summary } = streaks
  const longest = history.longest
  const span = (run: { start: DateKey; end: DateKey }) =>
    run.start === run.end
      ? formatDateKey(run.start, { day: 'numeric', month: 'short' })
      : `${formatDateKey(run.start, { day: 'numeric', month: 'short' })} – ${formatDateKey(run.end, { day: 'numeric', month: 'short' })}`
  return (
    <Section title="Streak history">
      <Facts
        items={[
          ['Now', plural(summary.current, 'day')],
          [
            'Longest',
            plural(longest?.days ?? 0, 'day'),
            longest ? span(longest) : 'None yet',
          ],
          [
            'Checked in',
            percent(history.days ? history.checkedIn / history.days : null),
            `${history.checkedIn} of ${history.days} days`,
          ],
          ['Streaks started', String(history.started), 'in this time'],
        ]}
      />
      {summary.total === 0 ? (
        <Empty>No check-ins yet.</Empty>
      ) : (
        <StreakArea
          heights={streaks.heights}
          label={`The streak each day: ${history.checkedIn} of ${history.days} days checked in, the longest run ${plural(history.longestInPeriod?.days ?? 0, 'day')}`}
          start={formatDateKey(range.from, { day: 'numeric', month: 'short' })}
          end="Today"
        />
      )}
    </Section>
  )
}

function TasksSection({ data, within }: { data: Analytics; within: string }) {
  const { tasks, range, today } = data
  const { total } = tasks
  const finished = tasks.finished.reduce((sum, count) => sum + count, 0)
  const columns: ColumnData[] = range.buckets.map((bucket, index) => {
    const { label, title } = describe(range, bucket, index)
    const column = tasks.byBucket[index]
    return {
      key: bucket.start,
      label,
      title: column.due
        ? `${title}: ${column.onTime} on time, ${column.late} late, ${column.open} still open`
        : `${title}: none due`,
      segments: [
        { key: 'on-time', value: column.onTime, color: ON_TIME },
        { key: 'late', value: column.late, color: LATE },
        { key: 'open', value: column.open, color: OPEN },
      ],
      faint: bucket.start > today,
    }
  })
  return (
    <Section title="Tasks">
      <Facts
        items={[
          [
            'Done',
            percent(completionRate(total)),
            `of ${plural(total.due, 'task')} due`,
          ],
          [
            'On time',
            percent(total.due ? total.onTime / total.due : null),
            `${total.late} late`,
          ],
          ['Still open', String(total.open), 'past their day'],
          ['Finished', String(finished), 'dated or not'],
        ]}
      />
      {total.due === 0 ? (
        <Empty>No tasks were due in {within}.</Empty>
      ) : (
        <>
          <Columns
            data={columns}
            label={`Tasks by the day they were due, over ${within}`}
            labelled={(index) =>
              describe(range, range.buckets[index], index).labelled
            }
            height="h-32"
          />
          <Legend
            items={[
              { label: 'On time', color: ON_TIME },
              { label: 'Late', color: LATE },
              { label: 'Still open', color: OPEN },
            ]}
          />
        </>
      )}
    </Section>
  )
}

function CardsSection({ data, within }: { data: Analytics; within: string }) {
  const { cards, range, today } = data
  if (!cards)
    return (
      <Section title="Card recall">
        <Empty>Reading your reviews…</Empty>
      </Section>
    )
  const { total, counts, target } = cards
  const columns: ColumnData[] = range.buckets.map((bucket, index) => {
    const { label, title } = describe(range, bucket, index)
    const column = cards.byBucket[index]
    const rate = recallRate(column)
    return {
      key: bucket.start,
      label,
      title:
        rate === null
          ? `${title}: no reviews due`
          : `${title}: ${percent(rate)} of ${plural(column.reviewed, 'card')} remembered`,
      segments: [{ key: 'recall', value: (rate ?? 0) * 100, color: RECALL }],
      faint: bucket.start > today,
    }
  })
  const [again, hard, good, easy] = counts.byRating
  return (
    <Section title="Card recall">
      <Facts
        items={[
          [
            'Remembered',
            percent(recallRate(total)),
            total.reviewed
              ? `of ${plural(total.reviewed, 'review')} due`
              : 'no reviews due',
          ],
          ['Aiming for', percent(target), 'set in Settings'],
          ['Ratings', String(counts.ratings), 'new cards too'],
          ['Days studied', String(counts.days), `of ${daysIn(range)}`],
        ]}
      />
      {counts.ratings === 0 ? (
        <Empty>No cards reviewed in {within}.</Empty>
      ) : (
        <>
          {total.reviewed > 0 && (
            <Columns
              data={columns}
              label={`Cards remembered, over ${within}`}
              max={100}
              guide={{ value: target * 100, label: `aim ${percent(target)}` }}
              labelled={(index) =>
                describe(range, range.buckets[index], index).labelled
              }
              height="h-32"
            />
          )}
          <div>
            <div
              className="flex h-2.5 overflow-hidden rounded-full bg-tint"
              role="img"
              aria-label={`Ratings: ${again} Again, ${hard} Hard, ${good} Good, ${easy} Easy`}
            >
              {(
                [
                  [again, OPEN],
                  [hard, LATE],
                  [good, ON_TIME],
                  [easy, RECALL],
                ] as const
              ).map(([count, color], index) =>
                count ? (
                  <span
                    key={index}
                    style={{
                      width: `${(count / counts.ratings) * 100}%`,
                      background: color,
                    }}
                  />
                ) : null,
              )}
            </div>
            <Legend
              items={[
                { label: `Again ${again}`, color: OPEN },
                { label: `Hard ${hard}`, color: LATE },
                { label: `Good ${good}`, color: ON_TIME },
                { label: `Easy ${easy}`, color: RECALL },
              ]}
            />
          </div>
        </>
      )}
    </Section>
  )
}
