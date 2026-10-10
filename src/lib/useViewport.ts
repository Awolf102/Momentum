import { useSyncExternalStore } from 'react'

function subscribe(onChange: () => void) {
  window.addEventListener('resize', onChange)
  return () => window.removeEventListener('resize', onChange)
}

// A string snapshot stays equal between resizes, as useSyncExternalStore requires.
const getSnapshot = () => `${window.innerWidth}x${window.innerHeight}`

/** The viewport size, updated on resize. */
export function useViewport(): { width: number; height: number } {
  const [width, height] = useSyncExternalStore(
    subscribe,
    getSnapshot,
    () => '0x0',
  )
    .split('x')
    .map(Number)
  return { width, height }
}
