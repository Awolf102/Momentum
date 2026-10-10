/** The flame's outer and inner shapes, in a 64 × 80 box (shared by the SVG and the share card). */
export const FLAME_VIEWBOX = { width: 64, height: 80 } as const
export const FLAME_OUTER =
  'M32 2C36 14 52 24 52 48C52 64 43 76 32 76C21 76 12 64 12 50C12 38 18 30 22 24C23 31 26 35 30 36C27 24 28 12 32 2Z'
export const FLAME_INNER =
  'M32 36C35 43 42 48 42 58C42 66 37.5 71 32 71C26.5 71 22 66 22 59.5C22 53 26 48.5 28.5 44C29.5 48 31 49.5 33.5 50C32 45 31.5 40.5 32 36Z'
