/** Links only become links if they're ordinary web addresses. */
export function safeUrl(value: string | null | undefined): string | null {
  if (!value) return null
  try {
    const url = new URL(value.trim())
    return url.protocol === 'http:' || url.protocol === 'https:'
      ? url.href
      : null
  } catch {
    return null
  }
}

const URL_IN_TEXT = /https?:\/\/[^\s<>"']+/i

/** The first web address in some text. */
export function findUrl(text: string): string | null {
  const match = URL_IN_TEXT.exec(text)
  // Trailing punctuation belongs to the sentence, not the link.
  return match ? safeUrl(match[0].replace(/[.,;:!?)\]]+$/, '')) : null
}

export const MAX_TEXT_LENGTH = 2000

/**
 * What another app shared (the PWA share target's title, text and url) as one
 * inbox item. Apps fill these in differently — some put the link in `text`,
 * some send only a title — so all three are combined without repeats.
 */
export function fromShare(params: URLSearchParams): {
  text: string
  url: string | null
} | null {
  const title = params.get('title')?.trim() ?? ''
  const text = params.get('text')?.trim() ?? ''
  const url = safeUrl(params.get('url')) ?? findUrl(text)
  const parts = [title, text]
    // Leave out the link itself (it's kept separately) and repeats.
    .map((part) => (url && part === url ? '' : part))
    .filter((part, index, all) => part && all.indexOf(part) === index)
  const body = parts.join(' — ').slice(0, MAX_TEXT_LENGTH)
  if (!body && !url) return null
  return { text: body || url!, url }
}

/** The address without "https://www." and query, for showing a link. */
export function displayUrl(url: string): string {
  try {
    const parsed = new URL(url)
    const path = parsed.pathname === '/' ? '' : parsed.pathname
    return `${parsed.hostname.replace(/^www\./, '')}${path}`.slice(0, 60)
  } catch {
    return url
  }
}
