import { useSyncExternalStore } from 'react'
import { remainingMs } from '../lib/timer'
import { focusTimerStore } from '../store'

/**
 * The time, refreshed as the countdown's seconds tick over. Only for display:
 * the timer itself never counts ticks. Ticks are lined up with the running
 * phase, so 24:59 becomes 24:58 exactly a second later.
 */
let current = Date.now()
const listeners = new Set<() => void>()
let timer: ReturnType<typeof setTimeout> | undefined

function delay(): number {
  const phase = focusTimerStore.get().phase
  if (!phase || phase.pausedAt !== null) return 1000
  return (remainingMs(phase, current) % 1000 || 1000) + 5
}

function tick() {
  current = Date.now()
  for (const listener of listeners) listener()
  timer = setTimeout(tick, delay())
}

// A started or resumed phase is drawn from the right moment.
focusTimerStore.subscribe(() => {
  current = Date.now()
  if (listeners.size > 0) {
    clearTimeout(timer)
    timer = setTimeout(tick, delay())
  }
})

function subscribe(listener: () => void) {
  if (listeners.size === 0) {
    current = Date.now()
    timer = setTimeout(tick, delay())
  }
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
    if (listeners.size === 0) clearTimeout(timer)
  }
}

const idle = () => () => {}
const snapshot = () => current

/** `live`: tick while something is counting down. */
export function useNow(live: boolean): number {
  return useSyncExternalStore(live ? subscribe : idle, snapshot, snapshot)
}
