/**
 * Gradient backgrounds as data, so the same description can be rendered as
 * CSS on screen and drawn onto a canvas for the share card.
 */
export type GradientStop = readonly [color: string, position: number]

export type GradientLayer =
  | {
      type: 'radial'
      /** Centre, in % of width and height. */
      at: readonly [number, number]
      /** Ellipse radii, in % of width and height. */
      size: readonly [number, number]
      stops: readonly GradientStop[]
    }
  | { type: 'linear'; stops: readonly GradientStop[] }

const stopsCss = (stops: readonly GradientStop[]) =>
  stops.map(([color, position]) => `${color} ${position}%`).join(', ')

/** Layers are listed top first, like CSS backgrounds. */
export function gradientCss(layers: readonly GradientLayer[]): string {
  return layers
    .map((layer) =>
      layer.type === 'radial'
        ? `radial-gradient(${layer.size[0]}% ${layer.size[1]}% at ${layer.at[0]}% ${layer.at[1]}%, ${stopsCss(layer.stops)})`
        : `linear-gradient(180deg, ${stopsCss(layer.stops)})`,
    )
    .join(', ')
}

export function drawGradient(
  context: CanvasRenderingContext2D,
  layers: readonly GradientLayer[],
  width: number,
  height: number,
): void {
  // Bottom layer first.
  for (const layer of [...layers].reverse()) {
    if (layer.type === 'linear') {
      const gradient = context.createLinearGradient(0, 0, 0, height)
      for (const [color, position] of layer.stops)
        gradient.addColorStop(position / 100, color)
      context.fillStyle = gradient
      context.fillRect(0, 0, width, height)
      continue
    }
    const cx = (layer.at[0] / 100) * width
    const cy = (layer.at[1] / 100) * height
    const rx = (layer.size[0] / 100) * width
    const ry = (layer.size[1] / 100) * height
    context.save()
    // Draw a unit circle stretched into the ellipse.
    context.translate(cx, cy)
    context.scale(rx, ry)
    const gradient = context.createRadialGradient(0, 0, 0, 0, 0, 1)
    for (const [color, position] of layer.stops)
      gradient.addColorStop(position / 100, color)
    context.fillStyle = gradient
    context.fillRect(-cx / rx, -cy / ry, width / rx, height / ry)
    context.restore()
  }
}
