import { useEffect, useState } from 'react'

/**
 * Milliseconds since `since`, redrawn as each second ticks over. Only for
 * showing how long something has taken.
 */
export function useElapsed(since: number): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>
    const tick = () => {
      const current = Date.now()
      setNow(current)
      timer = setTimeout(tick, 1000 - ((current - since) % 1000) + 5)
    }
    tick()
    return () => clearTimeout(timer)
  }, [since])
  return Math.max(0, now - since)
}
