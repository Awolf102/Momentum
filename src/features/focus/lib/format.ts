import type { PhaseKind } from '../types'

/** "24:59", or "1:05:00" for an hour or more. Rounds up, so 0:00 means done. */
export function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000))
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const seconds = total % 60
  const pad = (value: number) => String(value).padStart(2, '0')
  return hours > 0
    ? `${hours}:${pad(minutes)}:${pad(seconds)}`
    : `${pad(minutes)}:${pad(seconds)}`
}

export const PHASE_NAMES: Record<PhaseKind, string> = {
  focus: 'Focus',
  'short-break': 'Short break',
  'long-break': 'Long break',
}
