import katex from 'katex'
import 'katex/dist/katex.min.css'

/** TeX to HTML. Mistakes show in red rather than breaking the note. */
export function renderMath(tex: string, display: boolean): string {
  return (
    katex
      .renderToString(tex, {
        displayMode: display,
        throwOnError: false,
        // No \href, \includegraphics and the like from a note's text.
        trust: false,
        strict: 'ignore',
        output: 'htmlAndMathml',
      })
      // The copy of the TeX source kept for screen readers' benefit is
      // removed by the sanitiser anyway (as <annotation>), leaving it
      // loose in the MathML; take it out cleanly here instead.
      .replace(
        /<annotation encoding="application\/x-tex">[\s\S]*?<\/annotation>/g,
        '',
      )
      .replace(/<\/?semantics>/g, '')
  )
}
