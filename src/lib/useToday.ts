import { useSyncExternalStore } from 'react'
import { msUntilNextDay, toDateKey, type DateKey } from './date'

const listeners = new Set<() => void>()
let timer: ReturnType<typeof setTimeout> | undefined

function notify() {
  for (const listener of listeners) listener()
}

function scheduleMidnight() {
  clearTimeout(timer)
  // A small buffer makes sure the clock has actually crossed midnight.
  timer = setTimeout(() => {
    notify()
    scheduleMidnight()
  }, msUntilNextDay() + 250)
}

function onWake() {
  // Timers are throttled in background tabs, so re-check when the user returns.
  if (document.visibilityState === 'visible') {
    notify()
    scheduleMidnight()
  }
}

function subscribe(listener: () => void) {
  if (listeners.size === 0) {
    scheduleMidnight()
    document.addEventListener('visibilitychange', onWake)
    window.addEventListener('focus', onWake)
  }
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
    if (listeners.size === 0) {
      clearTimeout(timer)
      document.removeEventListener('visibilitychange', onWake)
      window.removeEventListener('focus', onWake)
    }
  }
}

// Strings compare by value, so reading the clock on every call is a stable snapshot.
const getSnapshot = () => toDateKey(new Date())

/** Today's local calendar day; re-renders when the day changes. */
export function useToday(): DateKey {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}
