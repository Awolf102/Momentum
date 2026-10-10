import { useEffect, useMemo, useState } from 'react'
import { useSearch } from 'wouter'
import { GlassCard } from '@/components/GlassCard'
import { useFocusTotals, type DayTotal } from '@/features/focus'
import { useLogLines } from '@/features/log'
import {
  buildTimeline,
  groupByMonth,
  LogMonth,
  LogToday,
  type DayFocus,
} from '@/features/log/page'
import {
  SUBJECT_COLORS,
  subjectsStore,
  type Subject,
} from '@/features/subjects'
import { useStreak } from '@/features/streak'
import { isDateKey, type DateKey } from '@/lib/date'
import { useStore } from '@/lib/store'

/** How many past days to show at first, and each time you ask for more. */
const PAGE = 60

/** Focus totals as the log shows them, with each subject's name and colour. */
function focusForLog(
  totals: ReadonlyMap<DateKey, DayTotal>,
  subjects: readonly Subject[],
): Map<DateKey, DayFocus> {
  const byId = new Map(subjects.map((subject) => [subject.id, subject]))
  const result = new Map<DateKey, DayFocus>()
  for (const [day, total] of totals) {
    const subjects = [...total.bySubject]
      .sort((a, b) => b[1] - a[1])
      .flatMap(([id]) => {
        const subject = byId.get(id)
        return subject
          ? [{ id, name: subject.name, color: SUBJECT_COLORS[subject.color] }]
          : []
      })
    result.set(day, {
      minutes: total.minutes,
      sessions: total.sessions,
      subjects,
    })
  }
  return result
}

export default function LogPage() {
  const streak = useStreak()
  const lines = useLogLines()
  const totals = useFocusTotals()
  const { subjects } = useStore(subjectsStore)
  const [shown, setShown] = useState(PAGE)

  const [today, ...past] = useMemo(
    () =>
      buildTimeline({
        lines,
        checkIns: streak.dates,
        focus: focusForLog(totals, subjects),
        today: streak.today,
      }),
    [lines, streak.dates, totals, streak.today, subjects],
  )

  // /log?day=… (a search result) shows that day, however far back.
  const wanted = new URLSearchParams(useSearch()).get('day')
  const found = isDateKey(wanted) ? wanted : null
  const [revealed, setRevealed] = useState<DateKey | null>(null)
  if (found && found !== revealed) {
    setRevealed(found)
    const index = past.findIndex((day) => day.day === found)
    if (index >= shown) setShown(Math.ceil((index + 1) / PAGE) * PAGE)
  }
  useEffect(() => {
    if (!found) return
    // After the shell's own scroll to the top of a new page.
    const frame = requestAnimationFrame(() =>
      document
        .getElementById(`log-${found}`)
        ?.scrollIntoView({ block: 'center', behavior: 'smooth' }),
    )
    return () => cancelAnimationFrame(frame)
  }, [found])

  const months = groupByMonth(past.slice(0, shown))

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col pt-2 pb-8 sm:pt-6 lg:pt-2">
      <h1 className="font-serif text-5xl leading-none tracking-tight text-shadow-soft sm:text-6xl">
        Log
      </h1>
      <p className="mt-3 text-[15px] text-fg-muted text-shadow-soft">
        One line a day: what you did, how it went.
      </p>
      <div className="mt-6 flex flex-col gap-4">
        <LogToday day={today} />
        {months.map((month) => (
          <LogMonth key={month.month} {...month} found={found} />
        ))}
        {past.length === 0 && (
          <GlassCard className="px-5 py-5 text-sm leading-relaxed text-fg-muted sm:px-6">
            Your log starts today. Days you check in or focus show up here, with
            your line for each, so you can look back on what you did.
          </GlassCard>
        )}
        {past.length > shown && (
          <button
            type="button"
            onClick={() => setShown((count) => count + PAGE)}
            className="mx-auto rounded-full glass px-5 py-2.5 text-sm font-semibold text-fg-muted transition hover:text-fg"
          >
            Show earlier days
          </button>
        )}
      </div>
    </div>
  )
}
