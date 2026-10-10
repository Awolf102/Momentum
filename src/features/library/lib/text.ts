/** A run of text on a page, as pdf.js reports it. */
export interface TextRun {
  str: string
  /** [a, b, c, d, x, y]: the run's position and font scale. */
  transform: number[]
  width: number
  hasEOL: boolean
}

/**
 * A page's text as one line of plain text, for searching: runs joined with
 * a space where there's a gap (or a line break) between them, and without
 * one where a word was split into pieces.
 */
export function pageText(runs: readonly TextRun[]): string {
  let text = ''
  let previous: TextRun | null = null
  for (const run of runs) {
    if (previous && !previous.hasEOL) {
      const size = Math.hypot(previous.transform[0], previous.transform[1]) || 1
      const end = previous.transform[4] + previous.width
      const gap = run.transform[4] - end
      const sameLine =
        Math.abs(run.transform[5] - previous.transform[5]) < size / 2
      if (!sameLine || gap > size * 0.15) text += ' '
    } else if (previous) {
      // A line break; words broken with a hyphen are joined again.
      text = text.endsWith('-') ? text.slice(0, -1) : `${text} `
    }
    text += run.str
    previous = run
  }
  return text.replace(/\s+/g, ' ').trim()
}
