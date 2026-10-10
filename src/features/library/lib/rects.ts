import type { PageRect } from '../types'

interface Box {
  left: number
  top: number
  width: number
  height: number
}

const round = (value: number) => Math.round(value * 10_000) / 10_000

/**
 * A selection's rectangles (from `Range.getClientRects()`) as fractions of
 * the page they're on: clipped to the page, slivers dropped, and the pieces
 * of each line joined into one.
 */
export function toPageRects(rects: readonly Box[], page: Box): PageRect[] {
  const clipped = rects.flatMap((rect) => {
    const left = Math.max(rect.left, page.left)
    const top = Math.max(rect.top, page.top)
    const right = Math.min(rect.left + rect.width, page.left + page.width)
    const bottom = Math.min(rect.top + rect.height, page.top + page.height)
    if (right - left < 1 || bottom - top < 2) return []
    return [{ left, top, right, bottom }]
  })
  clipped.sort((a, b) => a.top - b.top || a.left - b.left)
  const lines: typeof clipped = []
  for (const rect of clipped) {
    const line = lines.find((other) => {
      const overlap =
        Math.min(other.bottom, rect.bottom) - Math.max(other.top, rect.top)
      const height = Math.min(other.bottom - other.top, rect.bottom - rect.top)
      // Same line: mostly overlapping vertically, and touching or close.
      return (
        overlap > height * 0.6 &&
        rect.left <= other.right + height &&
        rect.right >= other.left - height
      )
    })
    if (line) {
      line.left = Math.min(line.left, rect.left)
      line.top = Math.min(line.top, rect.top)
      line.right = Math.max(line.right, rect.right)
      line.bottom = Math.max(line.bottom, rect.bottom)
    } else {
      lines.push({ ...rect })
    }
  }
  return lines.map((line) => ({
    x: round((line.left - page.left) / page.width),
    y: round((line.top - page.top) / page.height),
    w: round((line.right - line.left) / page.width),
    h: round((line.bottom - line.top) / page.height),
  }))
}

/** Whether a point (in page fractions) is on one of the rectangles. */
export function hits(
  rects: readonly PageRect[],
  point: { x: number; y: number },
): boolean {
  return rects.some(
    (rect) =>
      point.x >= rect.x &&
      point.x <= rect.x + rect.w &&
      point.y >= rect.y &&
      point.y <= rect.y + rect.h,
  )
}

/** In reading order: by page, then down the page, then across. */
export function readingOrder<
  T extends { page: number; rects: readonly PageRect[] },
>(items: readonly T[]): T[] {
  const top = (item: T) => item.rects[0]?.y ?? 0
  const left = (item: T) => item.rects[0]?.x ?? 0
  return [...items].sort(
    (a, b) => a.page - b.page || top(a) - top(b) || left(a) - left(b),
  )
}
