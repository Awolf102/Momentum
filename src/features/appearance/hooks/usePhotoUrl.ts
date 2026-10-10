import { useEffect, useState } from 'react'
import { loadPhoto, type PhotoVariant } from '../lib/photoStorage'

/** An object URL for a stored photo, revoked automatically when no longer needed. */
export function usePhotoUrl(
  photoId: string,
  variant: PhotoVariant,
): string | null {
  const [loaded, setLoaded] = useState<{ key: string; url: string } | null>(
    null,
  )
  const key = `${photoId}:${variant}`

  useEffect(() => {
    let cancelled = false
    let objectUrl: string | null = null
    loadPhoto(photoId, variant)
      .then((blob) => {
        if (cancelled || !blob) return
        objectUrl = URL.createObjectURL(blob)
        setLoaded({ key: `${photoId}:${variant}`, url: objectUrl })
      })
      .catch((error: unknown) =>
        console.error('[momentum] Could not load photo.', error),
      )
    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [photoId, variant])

  return loaded?.key === key ? loaded.url : null
}
