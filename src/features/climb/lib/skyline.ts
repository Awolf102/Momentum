import type { NormalizedPoint } from '@/features/appearance'

export interface Pixels {
  data: Uint8ClampedArray
  width: number
  height: number
}

/**
 * Finds the skyline — where the sky meets the mountains — in a small image.
 *
 * Each pixel row/column is scored by how sharply it changes from "sky" above
 * to "land" below (brighter or bluer above). Dynamic programming then finds the
 * left-to-right path with the strongest edges that never jumps more than a few
 * rows between neighbouring columns, which ignores clouds and texture.
 *
 * Returns one normalised y per column, or `null` when no clear skyline exists.
 */
export function detectSkyline({
  data,
  width,
  height,
}: Pixels): number[] | null {
  const luminance = new Float32Array(width * height)
  const blueness = new Float32Array(width * height)
  for (let index = 0; index < width * height; index++) {
    const r = data[index * 4]
    const g = data[index * 4 + 1]
    const b = data[index * 4 + 2]
    luminance[index] = 0.299 * r + 0.587 * g + 0.114 * b
    blueness[index] = b - (r + g) / 2
  }

  const WINDOW = 2
  const top = Math.max(WINDOW, Math.round(height * 0.04))
  const bottom = Math.min(height - WINDOW, Math.round(height * 0.92))
  const rows = bottom - top
  if (rows < 4 || width < 4) return null

  // Edge score: sky above should be brighter and/or bluer than land below.
  const edge = new Float32Array(width * rows)
  for (let x = 0; x < width; x++) {
    for (let row = 0; row < rows; row++) {
      const y = top + row
      let lumAbove = 0
      let lumBelow = 0
      let blueAbove = 0
      let blueBelow = 0
      for (let k = 1; k <= WINDOW; k++) {
        lumAbove += luminance[(y - k) * width + x]
        lumBelow += luminance[(y + k - 1) * width + x]
        blueAbove += blueness[(y - k) * width + x]
        blueBelow += blueness[(y + k - 1) * width + x]
      }
      const lum = (lumAbove - lumBelow) / WINDOW
      const blue = (blueAbove - blueBelow) / WINDOW
      edge[x * rows + row] =
        Math.max(0, lum) + 0.5 * Math.max(0, -lum) + 0.6 * Math.max(0, blue)
    }
  }

  // Dynamic programming: best path ending at (x, row).
  const MAX_JUMP = Math.max(2, Math.round(rows * 0.12))
  const JUMP_COST = 1.2
  const score = new Float32Array(width * rows)
  const from = new Int16Array(width * rows)
  for (let row = 0; row < rows; row++) score[row] = edge[row]
  for (let x = 1; x < width; x++) {
    for (let row = 0; row < rows; row++) {
      let best = -Infinity
      let bestRow = row
      const low = Math.max(0, row - MAX_JUMP)
      const high = Math.min(rows - 1, row + MAX_JUMP)
      for (let previous = low; previous <= high; previous++) {
        const candidate =
          score[(x - 1) * rows + previous] -
          JUMP_COST * Math.abs(previous - row)
        if (candidate > best) {
          best = candidate
          bestRow = previous
        }
      }
      score[x * rows + row] = best + edge[x * rows + row]
      from[x * rows + row] = bestRow
    }
  }

  let row = 0
  for (let candidate = 1; candidate < rows; candidate++) {
    if (
      score[(width - 1) * rows + candidate] > score[(width - 1) * rows + row]
    ) {
      row = candidate
    }
  }
  const path = new Array<number>(width)
  let strength = 0
  for (let x = width - 1; x >= 0; x--) {
    path[x] = row
    strength += edge[x * rows + row]
    row = from[x * rows + row]
  }

  // Too faint to be a real skyline (e.g. a flat or abstract image).
  if (strength / width < 10) return null

  // Light smoothing, then back to normalised coordinates.
  return path.map((_, x) => {
    let sum = 0
    let count = 0
    for (let k = Math.max(0, x - 2); k <= Math.min(width - 1, x + 2); k++) {
      sum += path[k]
      count++
    }
    return (top + sum / count) / height
  })
}

/**
 * Turns a skyline into a trail: from the lower end of the image up to the
 * highest point (the summit), sampled into a manageable number of points.
 */
export function trailFromSkyline(
  skyline: readonly number[],
  samples = 28,
): NormalizedPoint[] {
  const width = skyline.length
  if (width < 2) return []
  let summit = 0
  for (let x = 1; x < width; x++) if (skyline[x] < skyline[summit]) summit = x
  // Start from whichever edge is lower: the longer, more satisfying climb.
  const startLeft = skyline[0] >= skyline[width - 1]
  const start = startLeft ? 0 : width - 1
  if (start === summit) return []
  const points: NormalizedPoint[] = []
  for (let index = 0; index <= samples; index++) {
    const x = Math.round(start + ((summit - start) * index) / samples)
    points.push({ x: (x + 0.5) / width, y: skyline[x] })
  }
  return points
}
