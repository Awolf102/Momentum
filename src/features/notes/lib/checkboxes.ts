import { withoutCode } from './links'

// A task-list item, as GitHub's markdown reads one: "- [ ] text", "1. [x] text",
// also inside block quotes. Code is blanked out first, so examples don't count.
const BOX =
  /^(?:[ \t]*>)*[ \t]*(?:[-*+]|\d{1,9}[.)])[ \t]+\[([ xX])\](?= +\S)/gm

/** Where each checkbox's mark ("x" or a space) is in the text, in order. */
export function checkboxPositions(markdown: string): number[] {
  return [...withoutCode(markdown).matchAll(BOX)].map(
    (match) => match.index + match[0].length - 2,
  )
}

/** Ticks or unticks the nth checkbox. */
export function toggleCheckbox(markdown: string, index: number): string {
  const at = checkboxPositions(markdown)[index]
  if (at === undefined) return markdown
  const mark = markdown[at] === ' ' ? 'x' : ' '
  return markdown.slice(0, at) + mark + markdown.slice(at + 1)
}
