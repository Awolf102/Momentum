// The styles that decide where text wraps in a textarea.
const COPIED = [
  'boxSizing',
  'width',
  'borderTopWidth',
  'borderRightWidth',
  'borderBottomWidth',
  'borderLeftWidth',
  'paddingTop',
  'paddingRight',
  'paddingBottom',
  'paddingLeft',
  'fontFamily',
  'fontSize',
  'fontStyle',
  'fontVariant',
  'fontWeight',
  'fontStretch',
  'fontFeatureSettings',
  'lineHeight',
  'letterSpacing',
  'wordSpacing',
  'textIndent',
  'textTransform',
  'tabSize',
] as const

/**
 * Where a position in a textarea's text sits on screen, relative to the
 * textarea's top-left corner: measured with a hidden copy of the text.
 */
export function caretCoordinates(
  textarea: HTMLTextAreaElement,
  position: number,
): { top: number; left: number; height: number } {
  const style = getComputedStyle(textarea)
  const mirror = document.createElement('div')
  for (const property of COPIED) mirror.style[property] = style[property]
  Object.assign(mirror.style, {
    position: 'absolute',
    top: '0',
    left: '-9999px',
    visibility: 'hidden',
    whiteSpace: 'pre-wrap',
    overflowWrap: 'break-word',
  })
  mirror.textContent = textarea.value.slice(0, position)
  const marker = document.createElement('span')
  marker.textContent = '​'
  mirror.append(marker)
  document.body.append(mirror)
  const lineHeight = Number.parseFloat(style.lineHeight)
  const result = {
    top: marker.offsetTop - textarea.scrollTop,
    left: marker.offsetLeft - textarea.scrollLeft,
    height: Number.isFinite(lineHeight) ? lineHeight : marker.offsetHeight,
  }
  mirror.remove()
  return result
}
