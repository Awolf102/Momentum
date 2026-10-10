import { describe, expect, it } from 'vitest'
import { highlight } from './highlight'
import { needs } from './load'
import { renderMath } from './math'
import { createRenderer, type RenderContext } from './render'

const links: RenderContext = {
  noteFor: (title) => (title.toLowerCase() === 'karnaugh maps' ? 'n1' : null),
  taskFor: (title) => (title === 'Lab report' ? 't1' : null),
}

describe('rendering notes', () => {
  const plain = createRenderer()
  const full = createRenderer({ math: renderMath, highlight })

  it('renders markdown', () => {
    const html = plain('# Title\n\nSome **bold**\n- one\n- [x] done', links)
    expect(html).toContain('<h1>Title</h1>')
    expect(html).toContain('<strong>bold</strong>')
    expect(html).toContain('type="checkbox"')
  })

  it('links notes and tasks, offering to create missing notes', () => {
    const html = plain(
      'See [[Karnaugh maps|K-maps]], [[New idea]] and [[task:Lab report]].',
      links,
    )
    expect(html).toContain(
      '<a href="/notes/n1" class="wikilink" data-note="n1">K-maps</a>',
    )
    expect(html).toContain('data-new-note="New idea"')
    expect(html).toContain('data-task="t1"')
  })

  it('shows raw HTML as text', () => {
    const html = plain(
      '<img src=x onerror="alert(1)"> and <script>x</script>',
      links,
    )
    expect(html).not.toContain('<img')
    expect(html).not.toContain('<script')
    expect(html).toContain('&lt;img')
  })

  it('renders maths, and leaves money alone', () => {
    const html = full(
      'Euler: $e^{i\\pi} + 1 = 0$\n\n$$\n\\int_0^1 x\\,dx\n$$',
      links,
    )
    expect(html).toContain('class="katex"')
    expect(html).toContain('class="math-block"')
    expect(html).toContain('katex-display')
    expect(full('It cost $5 and $10.', links)).not.toContain('katex')
    // Without KaTeX loaded, the TeX shows as it is.
    expect(plain('$x^2$', links)).toContain(
      '<code class="math-source">x^2</code>',
    )
  })

  it("doesn't let TeX make links", () => {
    // Shown as a mistake, in red; the source is only kept as text.
    const html = full('$\\href{javascript:alert(1)}{x}$', links)
    expect(html).not.toMatch(/href=/)
    expect(html).toContain('#cc0000')
  })

  it('highlights code it knows, including Verilog', () => {
    const html = full(
      '```verilog\nmodule adder(input a, b, output s);\nendmodule\n```',
      links,
    )
    expect(html).toContain('class="hljs language-verilog"')
    expect(html).toContain('hljs-keyword')
    expect(full('```nonsense\nhello\n```', links)).toContain('<pre><code')
  })

  it('numbers checkboxes so they can be ticked', () => {
    const html = plain('- [ ] one\n- [x] two\n- plain', links)
    expect(html).toContain(
      '<li class="task-item"><input type="checkbox" data-box="0" disabled> one</li>',
    )
    expect(html).toContain('data-box="1" disabled checked')
    expect(html).toContain('<li>plain</li>')
    // Numbering starts again for each note.
    expect(plain('- [ ] again', links)).toContain('data-box="0"')
  })

  it('keeps clean MathML for screen readers', () => {
    const html = full('$x^2$', links)
    expect(html).toContain('<math')
    expect(html).not.toContain('<annotation')
    expect(html).not.toContain('<semantics')
  })

  it('knows what a note needs loaded', () => {
    expect(needs('plain text $5 and $10')).toEqual({ math: false, code: false })
    expect(needs('maths $x^2$ here')).toEqual({ math: true, code: false })
    expect(needs('```py\nprint()\n```')).toEqual({ math: false, code: true })
    expect(needs('`$x$` is code')).toEqual({ math: false, code: false })
  })
})
