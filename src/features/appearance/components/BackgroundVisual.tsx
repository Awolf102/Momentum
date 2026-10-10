import { motion } from 'motion/react'
import { useState } from 'react'
import { useViewport } from '@/lib/useViewport'
import { usePhotoUrl } from '../hooks/usePhotoUrl'
import { gradientCss } from '../lib/gradients'
import { LIGHT_OFF, type Light, type PhotoGrade } from '../lib/light'
import { PAN_DURATION, PAN_EASING } from '../pan'
import { SCENE_HEIGHT, SCENE_WIDTH, SCENES } from '../scenes'
import type { Background } from '../types'
import { MountainScene } from './MountainScene'

interface BackgroundVisualProps {
  background: Background
  /** The current light; defaults to off (the scene's dusk, ungraded photos). */
  light?: Light
  /** Thumbnails skip the entrance animation, colour grade and full-size photo. */
  thumbnail?: boolean
  /** Horizontal pan in pixels, revealing parts of the image that cover-fit crops. */
  pan?: number
}

/** Renders any kind of background at the size of its container. */
export function BackgroundVisual({
  background,
  light = LIGHT_OFF,
  thumbnail = false,
  pan = 0,
}: BackgroundVisualProps) {
  const viewport = useViewport()
  switch (background.kind) {
    case 'scene': {
      const scene = SCENES[background.scene]
      // The pan is in screen pixels; the scene's view box is in scene units.
      const scale = Math.max(
        viewport.width / SCENE_WIDTH,
        viewport.height / SCENE_HEIGHT,
      )
      return (
        <MountainScene
          className="size-full"
          palette={scene.palette ?? light.palette}
          extra={scene.extra}
          glowAt={scene.glowAt}
          shiftX={scale > 0 ? -pan / scale : 0}
        />
      )
    }
    case 'gradient':
      return (
        <div
          className="size-full"
          style={{ background: gradientCss(background.layers) }}
        />
      )
    case 'photo':
      return thumbnail ? (
        <Thumbnail src={background.src} />
      ) : (
        <Photo src={background.src} grade={light.grade} pan={pan} />
      )
    case 'user-photo':
      return (
        <UserPhoto
          photoId={background.photoId}
          thumbnail={thumbnail}
          grade={light.grade}
          pan={pan}
        />
      )
  }
}

function UserPhoto({
  photoId,
  thumbnail,
  grade,
  pan,
}: {
  photoId: string
  thumbnail: boolean
  grade: PhotoGrade
  pan: number
}) {
  const src = usePhotoUrl(photoId, thumbnail ? 'thumb' : 'full')
  if (!src) return <div className="size-full bg-tint" />
  return thumbnail ? (
    <Thumbnail src={src} />
  ) : (
    <Photo src={src} grade={grade} pan={pan} />
  )
}

function Thumbnail({ src }: { src: string }) {
  return (
    <img src={src} alt="" className="size-full object-cover" loading="lazy" />
  )
}

function Photo({
  src,
  grade,
  pan,
}: {
  src: string
  grade: PhotoGrade
  pan: number
}) {
  const [loaded, setLoaded] = useState(false)
  return (
    <div
      className="relative size-full transition-[filter] duration-[2000ms]"
      style={{
        filter: `brightness(${grade.brightness}) saturate(${grade.saturate})`,
      }}
    >
      {/* Fades in once decoded, with a slow settle so the photo feels alive. */}
      <motion.img
        src={src}
        alt=""
        onLoad={() => setLoaded(true)}
        initial={{ opacity: 0, scale: 1.06 }}
        animate={
          loaded ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 1.06 }
        }
        transition={{
          opacity: { duration: 0.8 },
          scale: { duration: 2.4, ease: [0.16, 1, 0.3, 1] },
        }}
        className="size-full object-cover"
        style={{
          // Centred plus the pan (the percentage is of the cropped overflow).
          objectPosition: `calc(50% + ${pan}px) 50%`,
          transition: `object-position ${PAN_DURATION}ms ${PAN_EASING}`,
        }}
      />
      {/* The light's colour, blended softly into the photo. */}
      <div
        className="absolute inset-0 mix-blend-soft-light transition-opacity duration-[2000ms]"
        style={{
          background: `linear-gradient(180deg, ${grade.top}, ${grade.bottom})`,
          opacity: grade.opacity,
        }}
      />
    </div>
  )
}
