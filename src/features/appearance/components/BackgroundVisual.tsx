import { motion } from 'motion/react'
import { useState } from 'react'
import { usePhotoUrl } from '../hooks/usePhotoUrl'
import type { Background } from '../types'
import { AlpineDusk } from './AlpineDusk'

interface BackgroundVisualProps {
  background: Background
  /** Thumbnails skip the entrance animation and load the small photo variant. */
  thumbnail?: boolean
}

/** Renders any kind of background at the size of its container. */
export function BackgroundVisual({
  background,
  thumbnail = false,
}: BackgroundVisualProps) {
  switch (background.kind) {
    case 'scene':
      return <AlpineDusk className="size-full" />
    case 'gradient':
      return (
        <div className="size-full" style={{ background: background.css }} />
      )
    case 'photo':
      return <Photo src={background.src} thumbnail={thumbnail} />
    case 'user-photo':
      return (
        <UserPhotoVisual photoId={background.photoId} thumbnail={thumbnail} />
      )
  }
}

function UserPhotoVisual({
  photoId,
  thumbnail,
}: {
  photoId: string
  thumbnail: boolean
}) {
  const src = usePhotoUrl(photoId, thumbnail ? 'thumb' : 'full')
  return src ? (
    <Photo src={src} thumbnail={thumbnail} />
  ) : (
    <div className="size-full bg-tint" />
  )
}

function Photo({ src, thumbnail }: { src: string; thumbnail: boolean }) {
  const [loaded, setLoaded] = useState(false)
  if (thumbnail) {
    return (
      <img src={src} alt="" className="size-full object-cover" loading="lazy" />
    )
  }
  return (
    // Fades in once decoded, with a slow settle so the photo feels alive.
    <motion.img
      src={src}
      alt=""
      onLoad={() => setLoaded(true)}
      initial={{ opacity: 0, scale: 1.06 }}
      animate={loaded ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 1.06 }}
      transition={{
        opacity: { duration: 0.8 },
        scale: { duration: 2.4, ease: [0.16, 1, 0.3, 1] },
      }}
      className="size-full object-cover"
    />
  )
}
