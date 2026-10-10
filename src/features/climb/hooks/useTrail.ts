import { useEffect, useState } from 'react'
import {
  SCENE_HEIGHT,
  SCENE_TRAIL,
  SCENE_WIDTH,
  usePhotoUrl,
  type Background,
  type NormalizedPoint,
} from '@/features/appearance'
import { useStore } from '@/lib/store'
import { detectSkyline, trailFromSkyline } from '../lib/skyline'
import { climbStore } from '../store'

export interface Trail {
  points: NormalizedPoint[]
  /** Image width / height. */
  aspect: number
  /** How the background is anchored when it covers the screen. */
  align: 'center' | 'bottom'
  source: 'scene' | 'traced' | 'automatic'
}

interface Analysis {
  aspect: number
  automatic: NormalizedPoint[] | null
}

/** Photos are analysed once per session. */
const analyses = new Map<string, Analysis>()

async function analysePhoto(src: string): Promise<Analysis> {
  const image = new Image()
  image.src = src
  await image.decode()
  const aspect = image.naturalWidth / image.naturalHeight
  // A small copy is plenty to find a skyline, and fast.
  const width = 128
  const height = Math.max(16, Math.round(width / aspect))
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d', { willReadFrequently: true })
  if (!context) return { aspect, automatic: null }
  context.drawImage(image, 0, 0, width, height)
  const skyline = detectSkyline(context.getImageData(0, 0, width, height))
  const automatic = skyline ? trailFromSkyline(skyline) : null
  return {
    aspect,
    automatic: automatic && automatic.length >= 2 ? automatic : null,
  }
}

function usePhotoAnalysis(
  key: string | null,
  src: string | null,
): Analysis | null {
  const [, setVersion] = useState(0)
  useEffect(() => {
    if (!key || !src || analyses.has(key)) return
    let cancelled = false
    analysePhoto(src)
      .then((analysis) => {
        analyses.set(key, analysis)
        if (!cancelled) setVersion((version) => version + 1)
      })
      .catch(() => {
        analyses.set(key, { aspect: 16 / 9, automatic: null })
        if (!cancelled) setVersion((version) => version + 1)
      })
    return () => {
      cancelled = true
    }
  }, [key, src])
  return key ? (analyses.get(key) ?? null) : null
}

/**
 * The trail for a background: traced by hand if the user drew one, the
 * built-in route for mountain scenes, or found automatically along the skyline
 * of a photo. `null` for gradients, or while a photo is still being analysed.
 */
export function useTrail(background: Background): Trail | null {
  const { trails } = useStore(climbStore)
  const traced = trails[background.id]
  const userPhotoSrc = usePhotoUrl(
    background.kind === 'user-photo' ? background.photoId : null,
    'thumb',
  )
  const photoSrc =
    background.kind === 'photo'
      ? background.src
      : background.kind === 'user-photo'
        ? userPhotoSrc
        : null
  const analysis = usePhotoAnalysis(photoSrc ? background.id : null, photoSrc)

  if (background.kind === 'gradient') return null
  if (background.kind === 'scene') {
    return {
      points: traced ?? SCENE_TRAIL,
      aspect: SCENE_WIDTH / SCENE_HEIGHT,
      align: 'bottom',
      source: traced ? 'traced' : 'scene',
    }
  }
  if (!analysis) return null
  const points = traced ?? analysis.automatic
  if (!points) return null
  return {
    points,
    aspect: analysis.aspect,
    align: 'center',
    source: traced ? 'traced' : 'automatic',
  }
}

/** Whether a background can show a climb at all (gradients can't). */
export function canClimb(background: Background): boolean {
  return background.kind !== 'gradient'
}
