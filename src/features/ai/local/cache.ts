/**
 * Model files are kept in the browser's Cache Storage once downloaded, so
 * the model works offline from then on. Usable from the page and workers.
 */
export const MODEL_CACHE = 'momentum-models'

/** Whether every one of these files is stored on this device. */
export async function filesStored(urls: readonly string[]): Promise<boolean> {
  if (typeof caches === 'undefined') return false
  const cache = await caches.open(MODEL_CACHE)
  for (const url of urls) if (!(await cache.match(url))) return false
  return true
}

/** Deletes every downloaded model file. */
export async function forgetModelFiles(): Promise<void> {
  if (typeof caches !== 'undefined') await caches.delete(MODEL_CACHE)
}

interface CachedBytesOptions {
  /** Older versions of the same file, deleted when this one is stored. */
  replaces?: (cachedUrl: string) => boolean
  signal?: AbortSignal
}

/**
 * A file's bytes: from the cache, or downloaded (reporting each piece's
 * size as it arrives) and then cached.
 */
export async function cachedBytes(
  url: string,
  onBytes: (count: number) => void,
  { replaces, signal }: CachedBytesOptions = {},
): Promise<ArrayBuffer> {
  // Absolute, so it compares equal to the URLs the cache lists.
  const absolute = new URL(url, globalThis.location?.href).href
  const cache =
    typeof caches === 'undefined' ? null : await caches.open(MODEL_CACHE)
  const cached = await cache?.match(absolute)
  if (cached) {
    const bytes = await cached.arrayBuffer()
    onBytes(bytes.byteLength)
    return bytes
  }
  const response = await fetch(absolute, { signal })
  if (!response.ok)
    throw new Error(`Couldn't download ${absolute} (${response.status}).`)
  const parts: Uint8Array[] = []
  let length = 0
  const reader = response.body?.getReader()
  if (reader) {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      parts.push(value)
      length += value.byteLength
      onBytes(value.byteLength)
    }
  } else {
    const whole = new Uint8Array(await response.arrayBuffer())
    parts.push(whole)
    length = whole.byteLength
    onBytes(length)
  }
  const bytes = new Uint8Array(length)
  let offset = 0
  for (const part of parts) {
    bytes.set(part, offset)
    offset += part.byteLength
  }
  if (cache) {
    if (replaces)
      for (const request of await cache.keys())
        if (request.url !== absolute && replaces(request.url))
          await cache.delete(request)
    await cache.put(
      absolute,
      new Response(bytes, {
        headers: {
          'Content-Type':
            response.headers.get('Content-Type') ?? 'application/octet-stream',
        },
      }),
    )
  }
  return bytes.buffer
}
