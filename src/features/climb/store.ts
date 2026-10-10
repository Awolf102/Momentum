import type { NormalizedPoint } from '@/features/appearance'
import { isRecord } from '@/lib/guards'
import { createPersistentStore } from '@/lib/persistentStore'
import { createStore } from '@/lib/store'

interface ClimbData {
  /** Trails traced by hand, keyed by background id. */
  trails: Record<string, NormalizedPoint[]>
}

function isPoint(value: unknown): value is NormalizedPoint {
  return (
    isRecord(value) &&
    typeof value.x === 'number' &&
    typeof value.y === 'number' &&
    Number.isFinite(value.x) &&
    Number.isFinite(value.y)
  )
}

function parseClimb(data: unknown): ClimbData | null {
  if (!isRecord(data) || !isRecord(data.trails)) return null
  const trails: ClimbData['trails'] = {}
  for (const [id, points] of Object.entries(data.trails)) {
    if (Array.isArray(points) && points.length >= 2 && points.every(isPoint)) {
      trails[id] = points.map(({ x, y }) => ({ x, y }))
    }
  }
  return { trails }
}

export const climbStore = createPersistentStore<ClimbData>({
  key: 'momentum.climb',
  version: 1,
  defaultValue: { trails: {} },
  parse: parseClimb,
})

export function saveTrail(
  backgroundId: string,
  points: NormalizedPoint[],
): void {
  climbStore.set((previous) => ({
    trails: { ...previous.trails, [backgroundId]: points },
  }))
}

export function clearTrail(backgroundId: string): void {
  climbStore.set((previous) => {
    const trails = { ...previous.trails }
    delete trails[backgroundId]
    return { trails }
  })
}

/** `view`: cards hidden, the climb shown on the mountain. `trace`: drawing a trail. */
export type ClimbView = 'off' | 'view' | 'trace'

export const climbViewStore = createStore<ClimbView>('off')

export const openClimb = () => climbViewStore.set('view')
export const closeClimb = () => climbViewStore.set('off')
export const startTracing = () => climbViewStore.set('trace')
export const toggleClimb = () =>
  climbViewStore.set((view) => (view === 'off' ? 'view' : 'off'))
