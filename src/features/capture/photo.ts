import { fitWithin, turned } from './lib/image'

/** A photo as it's sent: a JPEG, turned and scaled down, in base64. */
export interface PreparedPhoto {
  mediaType: 'image/jpeg'
  data: string
  width: number
  height: number
  /** Its size, for the preview. */
  bytes: number
}

/** The picture couldn't be read (a format this browser can't open, say). */
export class UnreadablePhoto extends Error {
  constructor() {
    super('This picture couldn’t be opened. Try a JPEG or PNG.')
    this.name = 'UnreadablePhoto'
  }
}

function toBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const url = String(reader.result)
      resolve(url.slice(url.indexOf(',') + 1))
    }
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })
}

/**
 * Reads a photo the right way up (as the camera recorded it), turns it a
 * number of quarter turns clockwise, scales it down to what providers read,
 * and encodes it as a JPEG. Nothing leaves the device here.
 */
export async function preparePhoto(
  file: Blob,
  quarterTurns = 0,
): Promise<PreparedPhoto> {
  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  } catch {
    throw new UnreadablePhoto()
  }
  try {
    const turns = ((quarterTurns % 4) + 4) % 4
    const upright = turned(bitmap.width, bitmap.height, turns)
    const { width, height } = fitWithin(upright.width, upright.height)
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext('2d')
    if (!context) throw new UnreadablePhoto()
    // Transparent pictures (screenshots, PNGs) go on white, as on paper.
    context.fillStyle = '#ffffff'
    context.fillRect(0, 0, width, height)
    context.translate(width / 2, height / 2)
    context.rotate((turns * Math.PI) / 2)
    const drawn = turned(width, height, turns)
    context.imageSmoothingQuality = 'high'
    context.drawImage(
      bitmap,
      -drawn.width / 2,
      -drawn.height / 2,
      drawn.width,
      drawn.height,
    )
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', 0.85),
    )
    if (!blob) throw new UnreadablePhoto()
    return {
      mediaType: 'image/jpeg',
      data: await toBase64(blob),
      width,
      height,
      bytes: blob.size,
    }
  } finally {
    bitmap.close()
  }
}
