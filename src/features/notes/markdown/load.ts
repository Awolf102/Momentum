import { withoutCode } from '../lib/links'
import type { RenderContext } from './render'

export type Renderer = (markdown: string, context: RenderContext) => string

// The same rules as the renderer's: $$block$$, or $inline$ that doesn't start
// or end with a space and isn't followed by a digit (so not "$5 and $10").
const MATH = /\$\$[\s\S]+?\$\$|\$[^\s$](?:[^$\n]*?[^\s$])?\$(?!\d)/

/** What a note needs beyond plain markdown: maths, code highlighting. */
export function needs(markdown: string): { math: boolean; code: boolean } {
  return {
    math: MATH.test(withoutCode(markdown)),
    code: /^\s{0,3}(```|~~~)\s*\S/m.test(markdown),
  }
}

const renderers = new Map<string, Promise<Renderer>>()
const ready = new Map<string, Renderer>()

const keyFor = (need: { math: boolean; code: boolean }) =>
  `${need.math}|${need.code}`

/**
 * A renderer that has loaded already, so the note shows without a wait. One
 * that handles maths or code renders notes without them just the same.
 */
export function readyRenderer(need: {
  math: boolean
  code: boolean
}): Renderer | undefined {
  const exact = ready.get(keyFor(need))
  if (exact) return exact
  for (const [key, renderer] of ready) {
    const [math, code] = key.split('|').map((part) => part === 'true')
    if ((math || !need.math) && (code || !need.code)) return renderer
  }
}

/**
 * The renderer, loaded on first use: markdown and the sanitiser always, KaTeX
 * only for notes with maths, the highlighter only for notes with code.
 */
export function loadRenderer(need: {
  math: boolean
  code: boolean
}): Promise<Renderer> {
  const key = keyFor(need)
  let renderer = renderers.get(key)
  if (!renderer) {
    renderer = (async () => {
      const [{ createRenderer }, { sanitize }, math, code] = await Promise.all([
        import('./render'),
        import('./sanitize'),
        need.math ? import('./math') : null,
        need.code ? import('./highlight') : null,
      ])
      const render = createRenderer({
        math: math?.renderMath,
        highlight: code?.highlight,
      })
      const renderer: Renderer = (markdown, context) =>
        sanitize(render(markdown, context))
      ready.set(key, renderer)
      return renderer
    })()
    // A failed load (offline before it was cached) can be tried again.
    renderer.catch(() => renderers.delete(key))
    renderers.set(key, renderer)
  }
  return renderer
}
