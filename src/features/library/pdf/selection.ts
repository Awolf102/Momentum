/**
 * Dependable text selection over pdf.js text layers, adapted from pdf.js's
 * own viewer (TextLayerBuilder, Apache-2.0). Each layer ends with an
 * "endOfContent" block. While you select, it covers the layer, so dragging
 * across the gaps between runs of text keeps selecting rather than jumping
 * to the top of the page; in browsers that need more (Safari, Chromium
 * before 148), it also follows the selection's moving end.
 */

/** Each text layer, and its endOfContent block. */
const layers = new Map<HTMLElement, HTMLElement>()
let listening: AbortController | null = null

function reset(end: HTMLElement, layer: HTMLElement) {
  layer.append(end)
  end.style.width = ''
  end.style.height = ''
  layer.classList.remove('selecting')
}

/** Firefox and newer Chromium select across gaps well on their own. */
function selectsWell(end: HTMLElement): boolean {
  if (getComputedStyle(end).getPropertyValue('-moz-user-select') === 'none')
    return true
  const brands = (
    navigator as Navigator & {
      userAgentData?: { brands: { brand: string; version: string }[] }
    }
  ).userAgentData?.brands
  const version = brands
    ? brands.find(({ brand }) => brand === 'Chromium')?.version
    : /\bChrome\/(\d+)\b/.exec(navigator.userAgent)?.[1]
  return Boolean(version) && Number.parseInt(version ?? '', 10) >= 148
}

function listen() {
  if (listening) return
  listening = new AbortController()
  const { signal } = listening
  let pointerDown = false
  let modern: boolean | undefined
  let previous: Range | null = null
  const resetAll = () => layers.forEach(reset)
  document.addEventListener('pointerdown', () => (pointerDown = true), {
    signal,
  })
  document.addEventListener(
    'pointerup',
    () => {
      pointerDown = false
      resetAll()
    },
    { signal },
  )
  window.addEventListener(
    'blur',
    () => {
      pointerDown = false
      resetAll()
    },
    { signal },
  )
  document.addEventListener('keyup', () => !pointerDown && resetAll(), {
    signal,
  })
  document.addEventListener(
    'selectionchange',
    () => {
      const selection = document.getSelection()
      if (!selection || selection.rangeCount === 0) return resetAll()
      const active = new Set<HTMLElement>()
      for (let index = 0; index < selection.rangeCount; index++) {
        const range = selection.getRangeAt(index)
        for (const layer of layers.keys())
          if (range.intersectsNode(layer)) active.add(layer)
      }
      for (const [layer, end] of layers) {
        if (active.has(layer)) layer.classList.add('selecting')
        else reset(end, layer)
      }
      const [firstEnd] = layers.values()
      if (!firstEnd) return
      modern ??= selectsWell(firstEnd)
      if (modern) return

      // Keep the end block just after the selection's moving end.
      const range = selection.getRangeAt(0)
      const movingStart =
        previous !== null &&
        (range.compareBoundaryPoints(Range.END_TO_END, previous) === 0 ||
          range.compareBoundaryPoints(Range.START_TO_END, previous) === 0)
      let anchor: Node | null = movingStart
        ? range.startContainer
        : range.endContainer
      if (anchor.nodeType === Node.TEXT_NODE) anchor = anchor.parentNode
      if (anchor && !movingStart && range.endOffset === 0) {
        do {
          while (anchor && !anchor.previousSibling) anchor = anchor.parentNode
          anchor = anchor?.previousSibling ?? null
        } while (anchor && !anchor.childNodes.length)
      }
      const element = anchor instanceof HTMLElement ? anchor : null
      const layer = element?.parentElement?.closest<HTMLElement>('.textLayer')
      const end = layer ? layers.get(layer) : undefined
      if (element?.parentElement && layer && end) {
        end.style.width = layer.style.width
        end.style.height = layer.style.height
        element.parentElement.insertBefore(
          end,
          movingStart ? element : element.nextSibling,
        )
      }
      previous = range.cloneRange()
    },
    { signal },
  )
}

/** Sets up selection on a rendered text layer; returns how to undo it. */
export function enableSelection(layer: HTMLElement): () => void {
  const end = document.createElement('div')
  end.className = 'endOfContent'
  layer.append(end)
  const onDown = () => layer.classList.add('selecting')
  layer.addEventListener('mousedown', onDown)
  layers.set(layer, end)
  listen()
  return () => {
    layer.removeEventListener('mousedown', onDown)
    layers.delete(layer)
    if (layers.size === 0) {
      listening?.abort()
      listening = null
    }
  }
}
