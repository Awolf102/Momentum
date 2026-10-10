import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useState, type ReactNode } from 'react'
import { GlassCard } from '@/components/GlassCard'
import { PauseIcon, PlayIcon, SkipIcon, TimerIcon } from '@/components/icons'
import { Kbd } from '@/components/Kbd'
import { findSubject, SUBJECT_COLORS, SubjectPicker } from '@/features/subjects'
import { streakStore } from '@/features/streak'
import { cn } from '@/lib/cn'
import { useStore } from '@/lib/store'
import { useToday } from '@/lib/useToday'
import {
  cancelFocus,
  pauseFocus,
  resumeFocus,
  skipBreak,
  startFocus,
} from '../actions'
import { useFocus } from '../hooks/useFocus'
import { PHASE_NAMES } from '../lib/format'
import {
  progress,
  remainingMs,
  scheduledEnd,
  SESSIONS_BEFORE_LONG_BREAK,
  sessionNumber,
} from '../lib/timer'
import { setFocusSubject } from '../store'
import type { ActivePhase } from '../types'
import { TimerDial } from './TimerDial'

/** The Pomodoro timer: pick a subject, focus, take the break. */
export function FocusCard() {
  const { timer, phase, now, durations, subjectId } = useFocus()
  const today = useToday()
  const checkedInToday = Boolean(useStore(streakStore).checkIns[today])
  const kind = phase?.kind ?? 'focus'
  const paused = phase?.pausedAt != null
  const running = Boolean(phase) && !paused
  const number = sessionNumber(timer)

  return (
    <GlassCard className="relative w-full overflow-hidden px-5 py-6 sm:px-8 sm:py-7">
      {/* A warm glow while focusing, a cool one on a break. */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit]">
        <div
          className={cn(
            'absolute -top-28 left-0 h-80 w-full transition-opacity duration-1000 sm:left-[-10%] sm:w-[60%]',
            kind === 'focus'
              ? 'bg-[radial-gradient(closest-side,rgb(251_146_60/0.18),transparent)]'
              : 'bg-[radial-gradient(closest-side,rgb(45_212_191/0.16),transparent)]',
            running ? 'opacity-100' : 'opacity-0',
          )}
        />
      </div>

      <div className="relative flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-[11px] font-semibold tracking-[0.18em] text-fg-subtle uppercase">
          <TimerIcon className="text-sm" />
          Focus
        </h2>
        <CycleDots
          completed={timer.completedInCycle}
          current={phase?.kind === 'focus' ? number : null}
        />
      </div>

      <div className="relative mt-5 flex flex-col items-center gap-6 sm:flex-row sm:gap-10">
        <TimerDial
          remainingMs={phase ? remainingMs(phase, now) : durations.focusMs}
          progress={phase ? progress(phase, now) : 0}
          kind={kind}
          paused={paused}
          idle={!phase}
        />
        <div className="flex w-full min-w-0 flex-1 flex-col gap-5">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={phase ? `${phase.kind}` : 'idle'}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4, transition: { duration: 0.12 } }}
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            >
              {phase ? (
                <PhaseDetails phase={phase} number={number} />
              ) : (
                <div>
                  <p className="mb-2.5 text-sm font-medium">
                    What are you working on?
                  </p>
                  <SubjectPicker value={subjectId} onChange={setFocusSubject} />
                </div>
              )}
            </motion.div>
          </AnimatePresence>
          <Controls phase={phase} subjectId={subjectId} />
          <p className="text-xs text-fg-subtle">
            {hint({
              phase,
              number,
              checkedInToday,
              focusMinutes: Math.round(durations.focusMs / 60_000),
            })}
          </p>
        </div>
      </div>
    </GlassCard>
  )
}

function hint(context: {
  phase: ActivePhase | null
  number: number
  checkedInToday: boolean
  focusMinutes: number
}): string {
  const { phase, number, checkedInToday, focusMinutes } = context
  if (!phase) {
    return checkedInToday
      ? `${focusMinutes}-minute sessions, with a long break after every ${SESSIONS_BEFORE_LONG_BREAK}th.`
      : 'Finish a session to check in for today.'
  }
  if (phase.pausedAt !== null) return "Paused. Pick it up when you're ready."
  const end = scheduledEnd(phase)
  const at = end
    ? new Date(end).toLocaleTimeString(undefined, {
        hour: 'numeric',
        minute: '2-digit',
      })
    : ''
  if (phase.kind === 'focus') return `Ends at ${at}.`
  if (phase.kind === 'long-break')
    return `${SESSIONS_BEFORE_LONG_BREAK} sessions done. Back at ${at}.`
  return `Next up: session ${number} of ${SESSIONS_BEFORE_LONG_BREAK}, at ${at}.`
}

function PhaseDetails({
  phase,
  number,
}: {
  phase: ActivePhase
  number: number
}) {
  const subject = findSubject(phase.subjectId)
  if (phase.kind === 'focus') {
    return (
      <div>
        <p className="text-xs text-fg-subtle">
          Session {number} of {SESSIONS_BEFORE_LONG_BREAK}
        </p>
        <p className="mt-1.5 flex items-center gap-2.5 text-xl font-semibold tracking-tight">
          {subject && (
            <span
              aria-hidden="true"
              className="size-3 rounded-full"
              style={{ background: SUBJECT_COLORS[subject.color] }}
            />
          )}
          {subject?.name ?? 'Focusing'}
        </p>
      </div>
    )
  }
  return (
    <div>
      <p className="text-xs text-fg-subtle">{PHASE_NAMES[phase.kind]}</p>
      <p className="mt-1.5 text-xl font-semibold tracking-tight">
        {phase.kind === 'long-break'
          ? 'Step away for a while.'
          : 'Stretch, breathe, look away.'}
      </p>
    </div>
  )
}

function Controls({
  phase,
  subjectId,
}: {
  phase: ActivePhase | null
  subjectId: string | null
}) {
  if (!phase) {
    return (
      <Primary onClick={() => startFocus(subjectId)} icon={<PlayIcon />} hotkey>
        Start focus
      </Primary>
    )
  }
  const paused = phase.pausedAt !== null
  if (phase.kind === 'focus') {
    return (
      <div className="flex flex-wrap items-center gap-2">
        {paused ? (
          <Primary onClick={resumeFocus} icon={<PlayIcon />} hotkey>
            Resume
          </Primary>
        ) : (
          <Secondary onClick={pauseFocus} icon={<PauseIcon />} hotkey>
            Pause
          </Secondary>
        )}
        <CancelButton />
      </div>
    )
  }
  return (
    <div className="flex flex-wrap items-center gap-2">
      {paused ? (
        <Primary onClick={resumeFocus} icon={<PlayIcon />} hotkey>
          Resume break
        </Primary>
      ) : (
        <Primary onClick={skipBreak} icon={<SkipIcon />}>
          Skip break
        </Primary>
      )}
      {paused ? (
        <Secondary onClick={skipBreak} icon={<SkipIcon />}>
          Skip break
        </Secondary>
      ) : (
        <Secondary onClick={pauseFocus} icon={<PauseIcon />} hotkey>
          Pause
        </Secondary>
      )}
    </div>
  )
}

interface ButtonProps {
  onClick: () => void
  icon: ReactNode
  children: ReactNode
  /** Show the F shortcut (on devices with a keyboard). */
  hotkey?: boolean
}

function Primary({ onClick, icon, children, hotkey }: ButtonProps) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.97 }}
      className="relative inline-flex items-center justify-center gap-2.5 overflow-hidden rounded-full bg-linear-to-br from-amber-300 via-orange-400 to-orange-500 px-6 py-3 text-[15px] font-semibold text-orange-950 shadow-[0_12px_32px_-12px_rgb(249_115_22/0.75)] transition-shadow hover:shadow-[0_16px_40px_-12px_rgb(249_115_22/0.9)]"
    >
      <span className="absolute inset-0 bg-linear-to-b from-white/35 to-transparent to-60%" />
      <span className="relative">{icon}</span>
      <span className="relative">{children}</span>
      {hotkey && (
        <kbd className="relative hidden h-5 min-w-5 items-center justify-center rounded-md bg-orange-950/15 px-1.5 font-sans text-[11px] font-semibold lg:inline-flex">
          F
        </kbd>
      )}
    </motion.button>
  )
}

function Secondary({ onClick, icon, children, hotkey }: ButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-2 rounded-full glass px-5 py-3 text-[15px] font-semibold transition hover:scale-[1.02] active:scale-95"
    >
      {icon}
      {children}
      {hotkey && <Kbd keys={['F']} className="hidden lg:inline-flex" />}
    </button>
  )
}

/** Cancelling asks twice: a cancelled session is gone and doesn't count. */
function CancelButton() {
  const [confirming, setConfirming] = useState(false)
  useEffect(() => {
    if (!confirming) return
    const timer = setTimeout(() => setConfirming(false), 4000)
    return () => clearTimeout(timer)
  }, [confirming])
  return (
    <button
      type="button"
      onClick={() => (confirming ? cancelFocus() : setConfirming(true))}
      className={cn(
        'rounded-full px-4 py-3 text-sm font-semibold transition hover:bg-tint',
        confirming ? 'text-rose-300 light:text-rose-600' : 'text-fg-muted',
      )}
    >
      {confirming ? "Cancel? It won't count" : 'Cancel'}
    </button>
  )
}

/** Four dots: sessions done in this cycle, and the one in progress. */
function CycleDots({
  completed,
  current,
}: {
  completed: number
  current: number | null
}) {
  return (
    <div
      className="flex items-center gap-1.5"
      aria-label={`${completed} of ${SESSIONS_BEFORE_LONG_BREAK} sessions before a long break`}
      role="img"
    >
      {Array.from({ length: SESSIONS_BEFORE_LONG_BREAK }, (_, index) => {
        const done = index < completed
        const active = current === index + 1
        return (
          <span
            key={index}
            className={cn(
              'size-2 rounded-full transition-colors duration-500',
              done
                ? 'bg-orange-400'
                : active
                  ? 'bg-orange-300/50 ring-2 ring-orange-300/30'
                  : 'bg-line',
            )}
          />
        )
      })}
    </div>
  )
}
