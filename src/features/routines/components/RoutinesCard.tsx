import { AnimatePresence, motion } from 'motion/react'
import { useMemo, useState } from 'react'
import { GlassCard } from '@/components/GlassCard'
import { CheckIcon, PlusIcon } from '@/components/icons'
import { isScheduled, summarizeHabit } from '@/features/habits'
import { cn } from '@/lib/cn'
import { localDay } from '@/lib/date'
import { useClock } from '@/lib/useClock'
import { useToday } from '@/lib/useToday'
import { useCompletedDays, useRoutines, useRuns } from '../hooks/useRoutines'
import {
  PART_NAMES,
  partOfDay,
  progress,
  sortForNow,
  TEMPLATES,
} from '../lib/day'
import { runId, toggleStep } from '../runs'
import { addRoutine, editRoutine, newRoutine } from '../store'
import type { Routine, RoutineRun } from '../types'
import { PartIcon } from './PartIcon'

const EMPTY = new Set<string>()

/** Today's routines: the one for now open as a checklist, the rest folded. */
export function RoutinesCard() {
  const routines = useRoutines()
  const runs = useRuns()
  const completed = useCompletedDays()
  const today = useToday()
  const now = partOfDay(useClock().getHours())
  const due = useMemo(
    () =>
      sortForNow(
        routines.filter((routine) => isScheduled(today, routine.weekdays)),
        now,
      ),
    [routines, today, now],
  )
  // The first unfinished one opens by itself; tapping another opens that.
  const [chosen, setChosen] = useState<string | null>(null)
  const firstOpen =
    due.find(
      (routine) =>
        !progress(routine, runs.get(runId(routine.id, today))).complete,
    )?.id ?? due[0]?.id
  const open = chosen && due.some((r) => r.id === chosen) ? chosen : firstOpen

  return (
    <GlassCard className="w-full px-5 py-5 sm:px-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-xs font-semibold tracking-[0.2em] text-fg-muted uppercase">
          <PartIcon part={now} className="text-sm" />
          Routines
        </h2>
        <button
          type="button"
          onClick={newRoutine}
          className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold text-fg-muted transition hover:bg-tint hover:text-fg"
        >
          <PlusIcon /> New routine
        </button>
      </div>

      {routines.length === 0 && (
        <div className="mt-3 space-y-3 px-1">
          <p className="text-sm leading-relaxed text-fg-subtle">
            A routine is a short checklist for a part of the day, fresh each
            morning. Start from one of these, then make it yours:
          </p>
          <div className="flex flex-wrap gap-2">
            {TEMPLATES.map((template) => (
              <button
                key={template.name}
                type="button"
                onClick={() => {
                  const routine = addRoutine(template)
                  if (routine) setChosen(routine.id)
                }}
                className="inline-flex items-center gap-2 rounded-full bg-tint px-3.5 py-1.5 text-sm font-medium text-fg-muted transition hover:text-fg"
              >
                <PartIcon part={template.part} />
                {template.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {routines.length > 0 && due.length === 0 && (
        <p className="mt-3 px-1 text-sm text-fg-subtle">No routines today.</p>
      )}

      <ul className="mt-2 divide-y divide-line">
        {due.map((routine) => {
          const run = runs.get(runId(routine.id, today))
          const days = completed.get(routine.id) ?? EMPTY
          const streak = summarizeHabit(
            days,
            today,
            routine.weekdays,
            localDay(routine.createdAt),
          ).current
          return (
            <RoutineRow
              key={routine.id}
              routine={routine}
              run={run}
              streak={streak}
              open={routine.id === open}
              onOpen={() => setChosen(routine.id)}
              day={today}
            />
          )
        })}
      </ul>
    </GlassCard>
  )
}

function RoutineRow({
  routine,
  run,
  streak,
  open,
  onOpen,
  day,
}: {
  routine: Routine
  run: RoutineRun | undefined
  streak: number
  open: boolean
  onOpen: () => void
  day: string
}) {
  const { done, total, complete } = progress(routine, run)
  const ticked = new Set(run?.done ?? [])
  return (
    <li className="py-3">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onOpen}
          aria-expanded={open}
          className="flex min-w-0 flex-1 items-center gap-3 rounded-lg text-left"
        >
          <span
            className={cn(
              'grid size-8 shrink-0 place-items-center rounded-full text-base',
              complete
                ? 'bg-orange-400 text-orange-950'
                : 'bg-tint text-fg-muted',
            )}
          >
            {complete ? (
              <CheckIcon strokeWidth={2.5} />
            ) : (
              <PartIcon part={routine.part} />
            )}
          </span>
          <span className="min-w-0">
            <span className="block truncate text-[15px] leading-snug">
              {routine.name}
            </span>
            <span className="block text-xs text-fg-subtle">
              {complete ? 'Done' : `${done} of ${total}`}
              {' · '}
              {PART_NAMES[routine.part]}
              {streak > 0 && ` · ${streak} in a row`}
            </span>
          </span>
        </button>
        <button
          type="button"
          onClick={() => editRoutine(routine.id)}
          className="rounded-full px-3 py-1.5 text-xs font-semibold text-fg-muted transition hover:bg-tint hover:text-fg"
        >
          Edit
        </button>
      </div>
      <div
        className="mt-2.5 h-1 overflow-hidden rounded-full bg-tint"
        aria-hidden="true"
      >
        <motion.div
          className="h-full rounded-full bg-linear-to-r from-amber-300 to-orange-500"
          initial={false}
          animate={{ width: total ? `${(done / total) * 100}%` : '0%' }}
          transition={{ type: 'spring', stiffness: 260, damping: 30 }}
        />
      </div>
      <AnimatePresence initial={false}>
        {open && (
          <motion.ol
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            {routine.steps.length === 0 && (
              <li className="pt-3 pl-11 text-sm text-fg-subtle">
                No steps yet — add some with Edit.
              </li>
            )}
            {routine.steps.map((step) => {
              const isDone = ticked.has(step.id)
              return (
                <li key={step.id} className="pt-2.5 pl-11">
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={isDone}
                    onClick={() => void toggleStep(routine.id, step.id, day)}
                    className="flex w-full items-center gap-3 rounded-lg text-left"
                  >
                    <span
                      className={cn(
                        'grid size-5 shrink-0 place-items-center rounded-md transition',
                        isDone
                          ? 'bg-orange-400 text-orange-950'
                          : 'ring-[1.5px] ring-fg-subtle',
                      )}
                    >
                      {isDone && (
                        <CheckIcon strokeWidth={3} className="text-xs" />
                      )}
                    </span>
                    <span
                      className={cn(
                        'text-sm',
                        isDone &&
                          'text-fg-subtle line-through decoration-fg-subtle/50',
                      )}
                    >
                      {step.text}
                    </span>
                  </button>
                </li>
              )
            })}
          </motion.ol>
        )}
      </AnimatePresence>
    </li>
  )
}
