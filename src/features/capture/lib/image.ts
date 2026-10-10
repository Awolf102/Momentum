import type { ProviderId } from '@/features/ai'

/**
 * How big a photo is sent. Anthropic reads up to 1568 px on the long side
 * and about 1.15 megapixels (more is scaled down on their side, so sending
 * it only costs upload time); that's plenty for handwriting.
 */
export const PHOTO_LIMITS = { maxSide: 1568, maxPixels: 1_150_000 }

/** A size scaled down (never up) to fit the limits, keeping its shape. */
export function fitWithin(
  width: number,
  height: number,
  { maxSide, maxPixels }: { maxSide: number; maxPixels: number } = PHOTO_LIMITS,
): { width: number; height: number } {
  const scale = Math.min(
    1,
    maxSide / Math.max(width, height),
    Math.sqrt(maxPixels / (width * height)),
  )
  return {
    width: Math.max(1, Math.floor(width * scale)),
    height: Math.max(1, Math.floor(height * scale)),
  }
}

/** A size turned a number of quarter turns. */
export function turned(
  width: number,
  height: number,
  quarterTurns: number,
): { width: number; height: number } {
  return quarterTurns % 2 === 0
    ? { width, height }
    : { width: height, height: width }
}

/**
 * About how many tokens a picture costs. Anthropic: width × height / 750.
 * OpenAI, read in detail: fitted into 2048 px, its short side to 768 px,
 * then 170 a 512 px tile, plus 85. Compatible servers vary; OpenAI's count
 * stands in for them.
 */
export function imageTokens(
  provider: ProviderId,
  width: number,
  height: number,
): number {
  if (provider === 'anthropic') return Math.ceil((width * height) / 750)
  const fit = Math.min(1, 2048 / Math.max(width, height))
  const short = Math.min(1, 768 / (Math.min(width, height) * fit))
  const scale = fit * short
  const tiles =
    Math.ceil((width * scale) / 512) * Math.ceil((height * scale) / 512)
  return 85 + 170 * tiles
}
