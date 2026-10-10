import { useClock } from '@/lib/useClock'
import { useProgress } from '@/lib/progress'
import { useStore } from '@/lib/store'
import { resolveBackground } from '../backgrounds'
import { getLight, type Light } from '../lib/light'
import { appearanceStore } from '../store'
import type { Background } from '../types'

/** The background on screen right now (falling back if the choice is locked or gone). */
export function useCurrentBackground(): Background {
  const { backgroundId, photos } = useStore(appearanceStore)
  const { longest } = useProgress()
  return resolveBackground(backgroundId, photos, longest)
}

/** The current light, following the clock or the streak per the setting. */
export function useLight(): Light {
  const { light } = useStore(appearanceStore)
  const { current } = useProgress()
  const now = useClock()
  return getLight(light, now, current)
}
