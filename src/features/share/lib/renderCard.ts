import {
  drawGradient,
  type GradientLayer,
  type PhotoGrade,
} from '@/features/appearance'
import { FLAME_INNER, FLAME_OUTER, FLAME_VIEWBOX } from '@/features/streak'
import { LOGO_COLORS, LOGO_RIDGE } from '@/lib/brand'
import { coverFit } from '@/lib/cover'

export type CardFormat = 'portrait' | 'square' | 'story'

export const CARD_SIZES: Record<CardFormat, { width: number; height: number }> =
  {
    portrait: { width: 1080, height: 1350 },
    square: { width: 1080, height: 1080 },
    story: { width: 1080, height: 1920 },
  }

export type CardBackground =
  | {
      kind: 'image'
      image: CanvasImageSource
      aspect: number
      align: 'center' | 'bottom'
      grade?: PhotoGrade
    }
  | { kind: 'gradient'; layers: readonly GradientLayer[] }

export interface CardContent {
  streak: number
  message: string
  footnote: string
}

const SERIF = '"Instrument Serif", Georgia, serif'
const SANS = '"Inter Variable", system-ui, sans-serif'

/** Fonts must be loaded before canvas text can use them. */
export async function loadCardFonts(): Promise<void> {
  await Promise.all([
    document.fonts.load(`400 300px ${SERIF}`),
    document.fonts.load(`italic 400 52px ${SERIF}`),
    document.fonts.load(`600 32px ${SANS}`),
  ])
}

function roundedRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  context.beginPath()
  context.roundRect(x, y, width, height, radius)
}

function drawBackground(
  context: CanvasRenderingContext2D,
  background: CardBackground,
  width: number,
  height: number,
  filter = 'none',
) {
  if (background.kind === 'gradient') {
    context.save()
    context.filter = filter
    drawGradient(context, background.layers, width, height)
    context.restore()
    return
  }
  const cover = coverFit(width, height, background.aspect, background.align)
  const grade = background.grade
  context.save()
  context.filter =
    [
      grade
        ? `brightness(${grade.brightness}) saturate(${grade.saturate})`
        : '',
      filter === 'none' ? '' : filter,
    ]
      .join(' ')
      .trim() || 'none'
  context.drawImage(
    background.image,
    cover.offsetX,
    cover.offsetY,
    cover.width,
    cover.height,
  )
  context.restore()
  if (grade && grade.opacity > 0) {
    context.save()
    context.globalCompositeOperation = 'soft-light'
    context.globalAlpha = grade.opacity
    const tint = context.createLinearGradient(0, 0, 0, height)
    tint.addColorStop(0, grade.top)
    tint.addColorStop(1, grade.bottom)
    context.fillStyle = tint
    context.fillRect(0, 0, width, height)
    context.restore()
  }
}

/** Draws text with extra letter spacing (canvas `letterSpacing` isn't everywhere yet). */
function drawTracked(
  context: CanvasRenderingContext2D,
  text: string,
  centerX: number,
  y: number,
  tracking: number,
) {
  const widths = [...text].map((char) => context.measureText(char).width)
  const total =
    widths.reduce((sum, width) => sum + width, 0) + tracking * (text.length - 1)
  let x = centerX - total / 2
  context.textAlign = 'left'
  ;[...text].forEach((char, index) => {
    context.fillText(char, x, y)
    x += widths[index] + tracking
  })
}

/** Wraps text into at most two lines of similar width (no lonely last word). */
function wrapLines(
  context: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string[] {
  if (context.measureText(text).width <= maxWidth) return [text]
  const words = text.split(' ')
  let best: string[] = [text]
  let bestWidth = Infinity
  for (let split = 1; split < words.length; split++) {
    const lines = [
      words.slice(0, split).join(' '),
      words.slice(split).join(' '),
    ]
    const widest = Math.max(
      ...lines.map((line) => context.measureText(line).width),
    )
    if (widest <= maxWidth && widest < bestWidth) {
      best = lines
      bestWidth = widest
    }
  }
  return best
}

function drawFlame(
  context: CanvasRenderingContext2D,
  centerX: number,
  top: number,
  height: number,
) {
  const scale = height / FLAME_VIEWBOX.height
  const left = centerX - (FLAME_VIEWBOX.width * scale) / 2
  context.save()
  // Warm glow behind the flame.
  const glow = context.createRadialGradient(
    centerX,
    top + height * 0.6,
    0,
    centerX,
    top + height * 0.6,
    height * 1.1,
  )
  glow.addColorStop(0, 'rgba(251,146,60,0.45)')
  glow.addColorStop(1, 'rgba(251,146,60,0)')
  context.fillStyle = glow
  context.fillRect(
    centerX - height * 1.2,
    top - height * 0.6,
    height * 2.4,
    height * 2.4,
  )

  context.translate(left, top)
  context.scale(scale, scale)
  const outer = context.createLinearGradient(0, 0, 0, FLAME_VIEWBOX.height)
  outer.addColorStop(0, '#fde68a')
  outer.addColorStop(0.45, '#fb923c')
  outer.addColorStop(1, '#e11d48')
  context.fillStyle = outer
  context.fill(new Path2D(FLAME_OUTER))
  const inner = context.createLinearGradient(0, 36, 0, 72)
  inner.addColorStop(0, '#fffbeb')
  inner.addColorStop(1, '#fcd34d')
  context.fillStyle = inner
  context.fill(new Path2D(FLAME_INNER))
  context.restore()
}

function drawLogo(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
) {
  const scale = size / 32
  context.save()
  context.translate(x, y)
  context.scale(scale, scale)
  roundedRect(context, 0, 0, 32, 32, 9)
  context.fillStyle = '#0b0f1f'
  context.fill()
  const ridge = context.createLinearGradient(0, 0, 32, 32)
  LOGO_COLORS.forEach((color, index) => ridge.addColorStop(index / 2, color))
  context.strokeStyle = ridge
  context.lineWidth = 3
  context.lineCap = 'round'
  context.lineJoin = 'round'
  context.stroke(new Path2D(LOGO_RIDGE))
  context.restore()
}

/** Renders the shareable streak card: the background, a glass card, the flame and the number. */
export function renderCard(
  canvas: HTMLCanvasElement,
  format: CardFormat,
  background: CardBackground,
  content: CardContent,
): void {
  const { width, height } = CARD_SIZES[format]
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Canvas is not available.')

  context.fillStyle = '#05070f'
  context.fillRect(0, 0, width, height)
  drawBackground(context, background, width, height)

  // Scrim and vignette, as on the dashboard.
  const scrim = context.createLinearGradient(0, 0, 0, height)
  scrim.addColorStop(0, 'rgba(4,6,14,0.15)')
  scrim.addColorStop(0.5, 'rgba(4,6,14,0.2)')
  scrim.addColorStop(1, 'rgba(4,6,14,0.6)')
  context.fillStyle = scrim
  context.fillRect(0, 0, width, height)

  // The glass card.
  const cardWidth = width * 0.78
  const cardHeight = Math.min(height * 0.62, 860)
  const cardX = (width - cardWidth) / 2
  const cardY = (height - cardHeight) / 2 + height * 0.02
  const radius = 64
  context.save()
  roundedRect(context, cardX, cardY, cardWidth, cardHeight, radius)
  context.clip()
  drawBackground(
    context,
    background,
    width,
    height,
    'blur(36px) saturate(160%)',
  )
  context.fillStyle = 'rgba(22,24,44,0.45)'
  context.fillRect(cardX, cardY, cardWidth, cardHeight)
  context.restore()
  roundedRect(
    context,
    cardX + 1,
    cardY + 1,
    cardWidth - 2,
    cardHeight - 2,
    radius,
  )
  context.strokeStyle = 'rgba(255,255,255,0.16)'
  context.lineWidth = 2
  context.stroke()

  // Content, laid out from the card's centre line.
  const centerX = width / 2
  const unit = cardHeight / 860
  let y = cardY + 90 * unit
  drawFlame(context, centerX, y, 120 * unit)
  y += 120 * unit + 250 * unit

  context.fillStyle = '#ffffff'
  context.textBaseline = 'alphabetic'
  context.textAlign = 'center'
  context.font = `400 ${300 * unit}px ${SERIF}`
  context.fillText(String(content.streak), centerX, y)

  y += 70 * unit
  context.font = `600 ${30 * unit}px ${SANS}`
  context.fillStyle = 'rgba(255,255,255,0.75)'
  drawTracked(context, 'DAY STREAK', centerX, y, 11 * unit)

  y += 100 * unit
  context.font = `italic 400 ${52 * unit}px ${SERIF}`
  context.fillStyle = '#ffffff'
  context.textAlign = 'center'
  const lines = wrapLines(context, content.message, cardWidth - 140 * unit)
  lines.forEach((line, index) =>
    context.fillText(line, centerX, y + index * 64 * unit),
  )

  // Brand and date beneath the card.
  const footerY = Math.min(
    height - 70,
    cardY + cardHeight + (height - cardY - cardHeight) / 2,
  )
  const logoSize = 44
  context.font = `600 30px ${SANS}`
  const name = 'Momentum'
  const nameWidth = context.measureText(name).width
  const groupWidth = logoSize + 16 + nameWidth
  drawLogo(context, centerX - groupWidth / 2, footerY - logoSize / 2, logoSize)
  context.fillStyle = '#ffffff'
  context.textAlign = 'left'
  context.textBaseline = 'middle'
  context.fillText(name, centerX - groupWidth / 2 + logoSize + 16, footerY + 1)
  context.font = `500 24px ${SANS}`
  context.fillStyle = 'rgba(255,255,255,0.6)'
  context.textAlign = 'center'
  context.fillText(content.footnote, centerX, footerY + 48)
}
