import type { PhotoVariant } from './photoStorage'

const FULL_SIZE = 2560
const THUMB_SIZE = 360

/**
 * Downscales a photo for use as a background (plus a thumbnail for the picker).
 * Phone photos are often 12+ megapixels; 2560px is plenty for a full-screen
 * background and keeps storage and decoding fast. EXIF rotation is applied.
 */
export async function processPhoto(
  file: File,
): Promise<Record<PhotoVariant, Blob>> {
  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  } catch {
    throw new Error(
      "That file couldn't be opened as an image. Try a JPEG, PNG or WebP.",
    )
  }
  try {
    const [full, thumb] = await Promise.all([
      resize(bitmap, FULL_SIZE, 0.88),
      resize(bitmap, THUMB_SIZE, 0.8),
    ])
    return { full, thumb }
  } finally {
    bitmap.close()
  }
}

function resize(
  source: ImageBitmap,
  maxSize: number,
  quality: number,
): Promise<Blob> {
  const scale = Math.min(1, maxSize / Math.max(source.width, source.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(source.width * scale)
  canvas.height = Math.round(source.height * scale)
  const context = canvas.getContext('2d')
  if (!context)
    return Promise.reject(new Error('Image processing is not supported here.'))
  context.imageSmoothingQuality = 'high'
  context.drawImage(source, 0, 0, canvas.width, canvas.height)
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) =>
        blob
          ? resolve(blob)
          : reject(new Error('Could not process the image.')),
      'image/jpeg',
      quality,
    ),
  )
}
