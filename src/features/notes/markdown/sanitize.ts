import DOMPurify from 'dompurify'

let configured = false

/**
 * The last word on what a note may show: scripts, event handlers and
 * non-web links are removed, whatever the renderer produced. Web links open
 * in a new tab.
 */
export function sanitize(html: string): string {
  if (!configured) {
    DOMPurify.addHook('afterSanitizeAttributes', (node) => {
      if (node.tagName !== 'A') return
      const href = node.getAttribute('href') ?? ''
      if (/^https?:/i.test(href)) {
        node.setAttribute('target', '_blank')
        node.setAttribute('rel', 'noopener noreferrer')
      }
    })
    configured = true
  }
  return DOMPurify.sanitize(html, {
    USE_PROFILES: { html: true, mathMl: true, svg: true },
  })
}
