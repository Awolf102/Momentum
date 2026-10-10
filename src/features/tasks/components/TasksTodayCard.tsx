import { AnimatePresence } from 'motion/react'
import { useMemo } from 'react'
import { Link } from 'wouter'
import { GlassCard } from '@/components/GlassCard'
import { ChecklistIcon } from '@/components/icons'
import { toDateKey } from '@/lib/date'
import { paths } from '@/lib/routes'
import { useToday } from '@/lib/useToday'
import { useTasks } from '../hooks/useTasks'
import { dueBy } from '../lib/groups'
import { QuickAdd } from './QuickAdd'
import { TaskRow } from './TaskRow'

const SHOWN = 6

/** Today's tasks on the dashboard: what's due (and overdue), and what's done. */
export function TasksTodayCard() {
  const all = useTasks()
  const today = useToday()
  const { due, doneToday } = useMemo(() => {
    const doneToday = all.filter(
      (task) =>
        task.status === 'done' &&
        task.completedAt &&
        toDateKey(new Date(task.completedAt)) === today,
    )
    return { due: dueBy(all, today), doneToday }
  }, [all, today])
  const shown = [...due, ...doneToday].slice(0, SHOWN)
  const more = due.length + doneToday.length - shown.length

  return (
    <GlassCard className="w-full px-5 py-5 sm:px-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-xs font-semibold tracking-[0.2em] text-fg-muted uppercase">
          <ChecklistIcon className="text-sm" />
          Today's tasks
        </h2>
        <Link
          href={paths.tasks}
          className="rounded-full px-3 py-1.5 text-xs font-semibold text-fg-muted transition hover:bg-tint hover:text-fg"
        >
          All tasks
        </Link>
      </div>
      <QuickAdd className="mt-3" />
      {shown.length > 0 ? (
        <ul className="mt-2 divide-y divide-line">
          <AnimatePresence initial={false}>
            {shown.map((task) => (
              <TaskRow key={task.id} task={task} today={today} />
            ))}
          </AnimatePresence>
        </ul>
      ) : (
        <p className="mt-3 px-1 text-sm text-fg-subtle">Nothing due today.</p>
      )}
      {more > 0 && (
        <Link
          href={paths.tasks}
          className="mt-1 inline-block rounded-full px-1 py-1 text-xs font-semibold text-fg-muted hover:text-fg"
        >
          {more} more
        </Link>
      )}
    </GlassCard>
  )
}
