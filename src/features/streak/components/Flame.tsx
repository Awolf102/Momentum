import { useId } from 'react'
import { cn } from '@/lib/cn'

interface FlameProps {
  /** Lit once the user has checked in today; grey and still otherwise. */
  lit: boolean
  className?: string
}

/** The streak flame. Flickers gently when lit (unless reduced motion is preferred). */
export function Flame({ lit, className }: FlameProps) {
  const id = useId().replace(/[^\w-]/g, '')
  return (
    <span className={cn('relative inline-flex', className)}>
      {/* Warm glow behind the flame. */}
      <span
        className={cn(
          'absolute inset-[-35%] rounded-full bg-[radial-gradient(circle,rgb(251_146_60/0.55),transparent_65%)] blur-md transition-opacity duration-700',
          lit ? 'opacity-100' : 'opacity-0',
        )}
      />
      <svg
        viewBox="0 0 64 80"
        aria-hidden="true"
        className={cn(
          'relative size-full origin-bottom transition-[filter,opacity] duration-700',
          lit ? 'motion-safe:animate-flicker' : 'opacity-55 grayscale',
        )}
      >
        <defs>
          <linearGradient id={`${id}-outer`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#fde68a" />
            <stop offset="0.45" stopColor="#fb923c" />
            <stop offset="1" stopColor="#e11d48" />
          </linearGradient>
          <linearGradient id={`${id}-inner`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#fffbeb" />
            <stop offset="1" stopColor="#fcd34d" />
          </linearGradient>
        </defs>
        <path
          fill={`url(#${id}-outer)`}
          d="M32 2C36 14 52 24 52 48C52 64 43 76 32 76C21 76 12 64 12 50C12 38 18 30 22 24C23 31 26 35 30 36C27 24 28 12 32 2Z"
        />
        <path
          fill={`url(#${id}-inner)`}
          d="M32 36C35 43 42 48 42 58C42 66 37.5 71 32 71C26.5 71 22 66 22 59.5C22 53 26 48.5 28.5 44C29.5 48 31 49.5 33.5 50C32 45 31.5 40.5 32 36Z"
        />
      </svg>
    </span>
  )
}
