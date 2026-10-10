/** Summits along the way. After the last one, there's a new summit every 100 days. */
export const SUMMITS = [7, 14, 30, 60, 100, 200, 365] as const

export function summitAfter(days: number): number {
  const next = SUMMITS.find((summit) => summit > days)
  if (next !== undefined) return next
  const last = SUMMITS[SUMMITS.length - 1]
  return last + Math.floor((days - last) / 100 + 1) * 100
}

export interface Climb {
  /** The streak length this climb describes. */
  days: number
  /** Which climb this is: 1 for the first summit, 2 for the second… */
  number: number
  /** Streak length at the trailhead (the previous summit). */
  base: number
  /** Streak length at the summit. */
  summit: number
  /** 0 at the trailhead, 1 on the summit. */
  progress: number
  daysToSummit: number
  atSummit: boolean
}

/**
 * Where the climber is for a given streak. Each climb runs from one summit to
 * the next; on a summit day the marker stands on the peak, and the next day a
 * new climb begins from its base.
 */
export function climbFor(streak: number): Climb {
  const days = Math.max(0, Math.floor(streak))
  // The summit we're climbing toward (or standing on, if today is a summit day).
  const summit = summitAfter(Math.max(0, days - 1))
  const base = days === 0 ? 0 : summitBefore(summit)
  let number = SUMMITS.findIndex((s) => s === summit) + 1
  if (number === 0) {
    number = SUMMITS.length + (summit - SUMMITS[SUMMITS.length - 1]) / 100
  }
  return {
    days,
    number,
    base,
    summit,
    progress: (days - base) / (summit - base),
    daysToSummit: summit - days,
    atSummit: days === summit,
  }
}

function summitBefore(summit: number): number {
  const index = SUMMITS.findIndex((s) => s === summit)
  if (index === 0) return 0
  if (index > 0) return SUMMITS[index - 1]
  return summit - 100
}
