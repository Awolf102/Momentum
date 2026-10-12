/**
 * Whether this page can reach a server at all, worked out before anything
 * is sent. Browsers refuse some requests themselves, before they leave the
 * device: the server never hears of them, and all the page sees is a
 * failed fetch. Saying which, and why, is the difference between "check
 * the server" and "open Momentum from another address".
 */

/** Where this copy of Momentum is running, as far as reaching servers goes. */
export interface Page {
  /** `location.origin`, e.g. `http://localhost:4173`. */
  origin: string
  /** Safari, and every browser on iPhone and iPad, run WebKit. */
  webkit: boolean
  /** Installed: opened from the Dock, the home screen or the app list. */
  installed: boolean
}

/** Why the browser will refuse a request from this page, or null. */
export type Blocked = 'mixed-content'

function urlOf(address: string): URL | null {
  try {
    return new URL(address)
  } catch {
    return null
  }
}

/**
 * localhost, *.localhost, 127.x.x.x and [::1]: this device. Browsers that
 * follow the spec treat these as secure even over http.
 */
export function isLoopback(hostname: string): boolean {
  const host = hostname.toLowerCase()
  return (
    host === 'localhost' ||
    host.endsWith('.localhost') ||
    host === '[::1]' ||
    host === '::1' ||
    /^127(\.\d{1,3}){3}$/.test(host)
  )
}

/**
 * Whether the browser will block a request to `address` before sending it.
 *
 * A page served over https can't fetch plain http ("mixed content"). The
 * spec lets loopback addresses through, and Chrome, Edge and Firefox do;
 * shipping Safari doesn't (WebKit counts `http://localhost` as secure for
 * the page's own origin, but blocks a fetch to it from an https page,
 * unless the site is on its list of exceptions).
 */
export function blockedBeforeSending(
  page: Pick<Page, 'origin' | 'webkit'>,
  address: string,
): Blocked | null {
  const from = urlOf(page.origin)
  const to = urlOf(address)
  if (!from || !to) return null
  if (from.protocol !== 'https:' || to.protocol !== 'http:') return null
  if (isLoopback(to.hostname) && !page.webkit) return null
  return 'mixed-content'
}

/** This page, or undefined outside a browser (tests, workers). */
export function currentPage(): Page | undefined {
  if (typeof window === 'undefined' || !window.location) return undefined
  return {
    origin: window.location.origin,
    webkit: /^Apple/.test(navigator.vendor ?? ''),
    installed:
      window.matchMedia?.('(display-mode: standalone)').matches === true ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true,
  }
}

/** Requests the page's Content Security Policy refused, by origin and when. */
const refusedByPolicy = new Map<string, number>()

/** Notes a request the page's policy refused (from its violation event). */
export function noteRefusal(blockedURI: string, at = Date.now()): void {
  const blocked = urlOf(blockedURI)
  if (blocked) refusedByPolicy.set(blocked.origin, at)
}

if (typeof document !== 'undefined')
  document.addEventListener('securitypolicyviolation', (event) => {
    if (event.effectiveDirective === 'connect-src')
      noteRefusal(event.blockedURI)
  })

/**
 * Whether a request to `address` was just refused by a Content Security
 * Policy. Momentum sets none, but a host or a wrapper around it could.
 */
export function refusedByContentPolicy(address: string, now = Date.now()) {
  const to = urlOf(address)
  if (!to) return false
  const at = refusedByPolicy.get(to.origin)
  return at !== undefined && now - at < 5000
}
