import { useMemo, useSyncExternalStore } from 'react'

const MINUTE = 60_000
const listeners = new Set<() => void>()
let timer: ReturnType<typeof setTimeout> | undefined

function tick() {
  for (const listener of listeners) listener()
  schedule()
}

function schedule() {
  clearTimeout(timer)
  timer = setTimeout(tick, MINUTE - (Date.now() % MINUTE) + 50)
}

function onWake() {
  if (document.visibilityState === 'visible') tick()
}

function subscribe(listener: () => void) {
  if (listeners.size === 0) {
    schedule()
    document.addEventListener('visibilitychange', onWake)
  }
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
    if (listeners.size === 0) {
      clearTimeout(timer)
      document.removeEventListener('visibilitychange', onWake)
    }
  }
}

// Whole minutes since the epoch: stable between ticks, so it's a valid snapshot.
const getSnapshot = () => Math.floor(Date.now() / MINUTE)

/** The current time, updated once a minute. */
export function useClock(): Date {
  const minutes = useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
  return useMemo(() => new Date(minutes * MINUTE), [minutes])
}
