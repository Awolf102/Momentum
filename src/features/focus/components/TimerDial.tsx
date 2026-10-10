import { useId } from 'react'
import { cn } from '@/lib/cn'
import { formatCountdown, PHASE_NAMES } from '../lib/format'
import type { PhaseKind } from '../types'

interface TimerDialProps {
  remainingMs: number
  /** 0 → 1 through the phase. */
  progress: number
  kind: PhaseKind
  paused: boolean
  idle: boolean
}

const SIZE = 240
const STROKE = 7
const RADIUS = (SIZE - STROKE) / 2 - 2
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

/** The countdown in the streak's serif, inside a thin ring that empties. */
export function TimerDial({
  remainingMs,
  progress,
  kind,
  paused,
  idle,
}: TimerDialProps) {
  const id = useId().replace(/[^\w-]/g, '')
  const focus = kind === 'focus'
  const minutesLeft = Math.ceil(remainingMs / 60_000)
  return (
    <div className="relative grid size-[216px] shrink-0 place-items-center sm:size-[240px]">
      <svg
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        aria-hidden="true"
        className="absolute inset-0 size-full -rotate-90"
      >
        <defs>
          <linearGradient id={`${id}-focus`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#fde68a" />
            <stop offset="0.5" stopColor="#fb923c" />
            <stop offset="1" stopColor="#f97316" />
          </linearGradient>
          <linearGradient id={`${id}-break`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#99f6e4" />
            <stop offset="1" stopColor="#38bdf8" />
          </linearGradient>
        </defs>
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          fill="none"
          stroke="var(--line)"
          strokeWidth={STROKE}
        />
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          fill="none"
          stroke={`url(#${id}-${focus ? 'focus' : 'break'})`}
          strokeWidth={STROKE}
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={CIRCUMFERENCE * progress}
          className={cn(
            'transition-[stroke-dashoffset,opacity] duration-1000 ease-linear motion-reduce:transition-none',
            idle ? 'opacity-35' : paused ? 'opacity-60' : 'opacity-100',
          )}
        />
      </svg>
      <div
        role="timer"
        aria-label={
          idle
            ? `${minutesLeft}-minute focus session`
            : `${minutesLeft} ${minutesLeft === 1 ? 'minute' : 'minutes'} left`
        }
        className="relative flex flex-col items-center"
      >
        <span
          className={cn(
            'font-serif text-[3.75rem] leading-none tracking-tight tabular-nums transition-opacity sm:text-[4.25rem]',
            paused && 'opacity-60',
          )}
        >
          {formatCountdown(remainingMs)}
        </span>
        <span className="mt-2 text-[11px] font-semibold tracking-[0.3em] text-fg-muted uppercase">
          {paused ? 'Paused' : PHASE_NAMES[kind]}
        </span>
      </div>
    </div>
  )
}
