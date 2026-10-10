import type { NormalizedPoint } from '@/features/appearance'
import type { Cover } from '@/lib/cover'

export { coverFit, type Cover } from '@/lib/cover'

/**
 * Trails are polylines in normalised image space (0–1 on each axis). Distances
 * are measured with the image's aspect ratio so the marker moves at an even pace.
 */
function segmentLength(a: NormalizedPoint, b: NormalizedPoint, aspect: number) {
  return Math.hypot((b.x - a.x) * aspect, b.y - a.y)
}

export function trailLength(
  points: readonly NormalizedPoint[],
  aspect: number,
): number {
  let total = 0
  for (let index = 1; index < points.length; index++) {
    total += segmentLength(points[index - 1], points[index], aspect)
  }
  return total
}

/**
 * Splits a trail at fraction `t` of its length: the part already walked, and
 * the part still ahead. Both include the point at `t`.
 */
export function splitTrail(
  points: readonly NormalizedPoint[],
  t: number,
  aspect: number,
): {
  walked: NormalizedPoint[]
  ahead: NormalizedPoint[]
  at: NormalizedPoint
} {
  if (points.length === 0) {
    const origin = { x: 0, y: 0 }
    return { walked: [], ahead: [], at: origin }
  }
  const target = Math.min(1, Math.max(0, t)) * trailLength(points, aspect)
  let travelled = 0
  for (let index = 1; index < points.length; index++) {
    const from = points[index - 1]
    const to = points[index]
    const length = segmentLength(from, to, aspect)
    if (travelled + length >= target && length > 0) {
      const f = (target - travelled) / length
      const at = {
        x: from.x + (to.x - from.x) * f,
        y: from.y + (to.y - from.y) * f,
      }
      return {
        walked: [...points.slice(0, index), at],
        ahead: [at, ...points.slice(index)],
        at,
      }
    }
    travelled += length
  }
  const end = points[points.length - 1]
  return { walked: [...points], ahead: [end], at: end }
}

export function toScreen(point: NormalizedPoint, cover: Cover) {
  return {
    x: cover.offsetX + point.x * cover.width,
    y: cover.offsetY + point.y * cover.height,
  }
}

export function fromScreen(
  x: number,
  y: number,
  cover: Cover,
): NormalizedPoint {
  return {
    x: (x - cover.offsetX) / cover.width,
    y: (y - cover.offsetY) / cover.height,
  }
}

/**
 * The trail as a little elevation profile for the climb card: fitted into a
 * unit box, always reading left to right from trailhead to summit.
 */
export function profileOf(
  points: readonly NormalizedPoint[],
): NormalizedPoint[] {
  if (points.length < 2) return []
  const xs = points.map((point) => point.x)
  const ys = points.map((point) => point.y)
  const [minX, maxX] = [Math.min(...xs), Math.max(...xs)]
  const [minY, maxY] = [Math.min(...ys), Math.max(...ys)]
  const flip = points[points.length - 1].x < points[0].x
  return points.map((point) => {
    const x = (point.x - minX) / (maxX - minX || 1)
    return {
      x: flip ? 1 - x : x,
      y: (point.y - minY) / (maxY - minY || 1),
    }
  })
}

export function polylinePoints(
  points: readonly { x: number; y: number }[],
): string {
  return points
    .map((point) => `${point.x.toFixed(1)},${point.y.toFixed(1)}`)
    .join(' ')
}

/**
 * How far to pan a covering background so the route is in view: centre the
 * whole trail if it fits, otherwise centre on the climber. Never pans past
 * the image's edges.
 */
export function panToShow(
  points: readonly NormalizedPoint[],
  focus: NormalizedPoint,
  cover: Cover,
  viewportWidth: number,
): number {
  if (points.length === 0) return 0
  const xs = points.map((point) => cover.offsetX + point.x * cover.width)
  const [left, right] = [Math.min(...xs), Math.max(...xs)]
  const target =
    right - left <= viewportWidth * 0.84
      ? (left + right) / 2
      : cover.offsetX + focus.x * cover.width
  const pan = viewportWidth / 2 - target
  const min = viewportWidth - (cover.offsetX + cover.width)
  const max = -cover.offsetX
  return Math.min(max, Math.max(min, pan)) || 0 // avoid -0
}
