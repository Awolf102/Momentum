import {
  loadPhoto,
  SCENE_HEIGHT,
  SCENE_WIDTH,
  type Background,
  type Light,
} from '@/features/appearance'
import type { CardBackground } from './renderCard'

async function loadImage(src: string): Promise<HTMLImageElement> {
  const image = new Image()
  image.src = src
  await image.decode()
  return image
}

/** The mountain scene on screen, copied as an image (so it keeps the current light). */
async function sceneImage(
  backgroundId: string,
): Promise<HTMLImageElement | null> {
  const svg = document.querySelector<SVGSVGElement>(
    `[data-background-id="${CSS.escape(backgroundId)}"] svg[data-scene]`,
  )
  if (!svg) return null
  const copy = svg.cloneNode(true) as SVGSVGElement
  copy.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
  copy.setAttribute('width', String(SCENE_WIDTH))
  copy.setAttribute('height', String(SCENE_HEIGHT))
  // Unpanned, whatever view is on screen.
  copy.setAttribute('viewBox', `0 0 ${SCENE_WIDTH} ${SCENE_HEIGHT}`)
  copy.removeAttribute('class')
  const markup = new XMLSerializer().serializeToString(copy)
  const url = URL.createObjectURL(new Blob([markup], { type: 'image/svg+xml' }))
  try {
    return await loadImage(url)
  } finally {
    URL.revokeObjectURL(url)
  }
}

const FALLBACK: CardBackground = {
  kind: 'gradient',
  layers: [
    {
      type: 'linear',
      stops: [
        ['#101838', 0],
        ['#05070f', 100],
      ],
    },
  ],
}

/** Gets the current background ready to draw onto the share card. */
export async function loadCardBackground(
  background: Background,
  light: Light,
): Promise<CardBackground> {
  switch (background.kind) {
    case 'gradient':
      return { kind: 'gradient', layers: background.layers }
    case 'scene': {
      const image = await sceneImage(background.id)
      if (!image) return FALLBACK
      return {
        kind: 'image',
        image,
        aspect: SCENE_WIDTH / SCENE_HEIGHT,
        align: 'bottom',
      }
    }
    case 'photo': {
      const image = await loadImage(background.src)
      return {
        kind: 'image',
        image,
        aspect: image.naturalWidth / image.naturalHeight,
        align: 'center',
        grade: light.grade,
      }
    }
    case 'user-photo': {
      const blob = await loadPhoto(background.photoId, 'full')
      if (!blob) return FALLBACK
      const image = await createImageBitmap(blob)
      return {
        kind: 'image',
        image,
        aspect: image.width / image.height,
        align: 'center',
        grade: light.grade,
      }
    }
  }
}
