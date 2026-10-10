// What the goal screens share besides components (kept apart from them, so
// fast refresh keeps working).
import { daysBetween, formatDateKey, type DateKey } from '@/lib/date'
import type { Pace } from '../lib/progress'

export const plural = (count: number, one: string, many = `${one}s`) =>
  `${count} ${count === 1 ? one : many}`

export const primary =
  'inline-flex items-center justify-center gap-1.5 rounded-full bg-linear-to-br from-amber-300 to-orange-500 px-4 py-2 text-sm font-semibold text-orange-950 shadow-[0_10px_24px_-12px_rgb(249_115_22/0.8)] transition active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40'
export const secondary =
  'inline-flex items-center justify-center gap-1.5 rounded-full bg-tint px-4 py-2 text-sm font-semibold transition hover:bg-line disabled:pointer-events-none disabled:opacity-40'
/** A button on the background itself, outside the cards. */
export const onGlass =
  'inline-flex items-center justify-center gap-1.5 rounded-full glass px-4 py-2 text-sm font-semibold transition hover:bg-tint'
export const quiet =
  'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold text-fg-muted transition hover:bg-tint hover:text-fg'
export const fieldClass =
  'h-10 rounded-xl bg-tint px-3 text-sm outline-none focus-visible:outline-2'
export const sectionTitle =
  'text-xs font-semibold tracking-[0.14em] text-fg-subtle uppercase'

export const PACE: Record<Pace, { label: string; tone: string }> = {
  ahead: {
    label: 'Ahead',
    tone: 'bg-emerald-400/15 text-emerald-200 light:text-emerald-700',
  },
  'on-track': {
    label: 'On track',
    tone: 'bg-sky-400/15 text-sky-200 light:text-sky-700',
  },
  behind: {
    label: 'Behind',
    tone: 'bg-rose-400/15 text-rose-200 light:text-rose-700',
  },
}

export const percent = (share: number) => `${Math.round(share * 100)}%`

/** "12 Oct", or "12 Oct 2027" in another year. */
export function shortDate(day: DateKey, today: DateKey): string {
  return formatDateKey(day, {
    day: 'numeric',
    month: 'short',
    ...(day.slice(0, 4) === today.slice(0, 4) ? {} : { year: 'numeric' }),
  })
}

/** How long until the target: "52 days left", "Today", "3 days past". */
export function timeLeft(daysLeft: number): string {
  if (daysLeft === 0) return 'Today'
  if (daysLeft === 1) return 'Tomorrow'
  if (daysLeft > 1) return `${daysLeft} days left`
  return `${plural(-daysLeft, 'day')} past`
}

/** When a milestone is due: "Due today", "Due 5 Nov", "Was due 3 Oct". */
export function dueLabel(due: DateKey, today: DateKey): string {
  const days = daysBetween(today, due)
  if (days === 0) return 'Due today'
  if (days === 1) return 'Due tomorrow'
  return `${days < 0 ? 'Was due' : 'Due'} ${shortDate(due, today)}`
}
