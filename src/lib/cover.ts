/** How a background fills the screen: like CSS `object-fit: cover`. */
export interface Cover {
  width: number
  height: number
  offsetX: number
  offsetY: number
}

/**
 * Size and position of an image of `aspect` (width / height) covering a
 * viewport, centred horizontally and either centred or bottom-aligned.
 */
export function coverFit(
  viewportWidth: number,
  viewportHeight: number,
  aspect: number,
  align: 'center' | 'bottom',
): Cover {
  const scale = Math.max(viewportWidth / aspect, viewportHeight)
  const width = aspect * scale
  const height = scale
  return {
    width,
    height,
    offsetX: (viewportWidth - width) / 2,
    offsetY:
      align === 'bottom'
        ? viewportHeight - height
        : (viewportHeight - height) / 2,
  }
}
