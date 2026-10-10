import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { AutoHeight } from '@/components/AutoHeight'
import { GlassCard } from '@/components/GlassCard'
import { CheckIcon } from '@/components/icons'
import { getMotivation } from '@/features/motivation'
import { cn } from '@/lib/cn'
import { weekStartsOn } from '@/lib/locale'
import type { StreakState } from '../hooks/useStreak'
import { describeStreak } from '../lib/copy'
import { onCheckIn } from '../store'
import { createEmbers, type Ember } from '../lib/embers'
import { EmberBurst } from './EmberBurst'
import { Flame } from './Flame'
import { WeekStrip } from './WeekStrip'

/** The centrepiece: flame, streak number, this week, and the daily check-in. */
export function StreakHero({
  streak,
  corner,
  footer,
}: {
  streak: StreakState
  /** Optional control in the card's top-right corner (e.g. share). */
  corner?: ReactNode
  /** Shown under the day's message once checked in (e.g. today's log line). */
  footer?: ReactNode
}) {
  const reduceMotion = useReducedMotion()
  const [burst, setBurst] = useState<{ id: number; embers: Ember[] } | null>(
    null,
  )
  const [justCheckedIn, setJustCheckedIn] = useState(false)
  const checkedIn = useMemo(() => new Set(streak.dates), [streak.dates])
  const lit = streak.checkedInToday

  // Celebrate every check-in for today, however it happened (button,
  // shortcut, palette, or finishing the day's first focus session).
  const today = streak.today
  useEffect(
    () =>
      onCheckIn((day) => {
        if (day !== today) return
        setJustCheckedIn(true)
        if (!reduceMotion) setBurst({ id: Date.now(), embers: createEmbers() })
        navigator.vibrate?.(12)
      }),
    [reduceMotion, today],
  )

  return (
    <GlassCard className="relative w-full max-w-xl px-6 pt-10 pb-8 text-center sm:px-10 sm:pt-12 sm:pb-10">
      {/* A warm wash across the top of the card once the flame is lit. */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit]">
        <div
          className={cn(
            'absolute inset-x-0 -top-10 h-64 bg-[radial-gradient(55%_100%_at_50%_0%,rgb(251_146_60/0.22),transparent)] transition-opacity duration-1000',
            lit ? 'opacity-100' : 'opacity-0',
          )}
        />
      </div>

      {corner && (
        <div className="absolute top-4 right-4 sm:top-5 sm:right-5">
          {corner}
        </div>
      )}

      <div className="relative mx-auto size-16 sm:size-[72px]">
        <Flame lit={lit} className="size-full" />
        {burst && <EmberBurst key={burst.id} embers={burst.embers} />}
      </div>

      <h1 className="relative mt-3">
        <span className="sr-only">Current streak: </span>
        <StreakNumber value={streak.current} />
        <span className="mt-1 block text-xs font-semibold tracking-[0.3em] text-fg-muted uppercase">
          Day streak
        </span>
      </h1>

      <p className="relative mx-auto mt-4 max-w-sm text-[15px] leading-relaxed text-balance text-fg-muted">
        {describeStreak(streak)}
      </p>

      <div className="relative mt-8">
        <WeekStrip
          today={streak.today}
          checkedIn={checkedIn}
          weekStartsOn={weekStartsOn}
        />
      </div>

      <AutoHeight className="relative mt-8">
        <AnimatePresence initial={false} mode="wait">
          {lit ? (
            <motion.div
              key="done"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{
                duration: 0.5,
                delay: 0.15,
                ease: [0.16, 1, 0.3, 1],
              }}
              className="flex flex-col items-center gap-4"
            >
              <span className="inline-flex items-center gap-2 rounded-full bg-tint px-4 py-2 text-sm font-medium text-fg-muted">
                <CheckIcon
                  className="text-base text-orange-300 light:text-orange-500"
                  strokeWidth={2.5}
                />
                Checked in for today
              </span>
              <p className="max-w-md font-serif text-[1.65rem] leading-snug text-balance text-fg italic">
                “{getMotivation({ streak: streak.current, date: streak.today })}
                ”
              </p>
              {footer && (
                <div className="flex w-full justify-center">{footer}</div>
              )}
            </motion.div>
          ) : (
            <motion.button
              key="check-in"
              type="button"
              onClick={() => streak.checkIn()}
              exit={{ opacity: 0, scale: 0.94, transition: { duration: 0.18 } }}
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.97 }}
              className="relative inline-flex w-full max-w-xs items-center justify-center overflow-hidden rounded-full bg-linear-to-br from-amber-300 via-orange-400 to-orange-500 px-8 py-4 text-base font-semibold text-orange-950 shadow-[0_12px_32px_-10px_rgb(249_115_22/0.75)] transition-shadow hover:shadow-[0_16px_40px_-10px_rgb(249_115_22/0.9)]"
            >
              <span className="absolute inset-0 bg-linear-to-b from-white/35 to-transparent to-60%" />
              <span className="relative">Check in for today</span>
            </motion.button>
          )}
        </AnimatePresence>
      </AutoHeight>

      <p className="sr-only" aria-live="polite">
        {justCheckedIn && lit
          ? `Checked in for today. ${streak.current}-day streak.`
          : ''}
      </p>
    </GlassCard>
  )
}

/** The big number; rolls up to its new value. */
function StreakNumber({ value }: { value: number }) {
  return (
    <span className="relative block font-serif text-[7rem] leading-[0.95] tracking-tight text-fg tabular-nums sm:text-[8.5rem]">
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={value}
          className="inline-block"
          initial={{ y: '45%', opacity: 0, filter: 'blur(8px)' }}
          animate={{ y: 0, opacity: 1, filter: 'blur(0px)' }}
          exit={{ y: '-45%', opacity: 0, filter: 'blur(8px)' }}
          transition={{
            type: 'spring',
            stiffness: 220,
            damping: 22,
            delay: 0.1,
          }}
        >
          {value}
        </motion.span>
      </AnimatePresence>
    </span>
  )
}
