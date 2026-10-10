import { Marked, type Tokens } from 'marked'
import { parseLink, type WikiLink } from '../lib/links'

/** How links in a note find what they point to. */
export interface RenderContext {
  /** The id of the note titled this, if there is one. */
  noteFor(title: string): string | null
  /** The id of the task titled this, if there is one. */
  taskFor(title: string): string | null
}

/** The heavier tools, loaded only for notes that need them. */
export interface RenderTools {
  /** TeX to HTML (KaTeX), for notes with maths. */
  math?: (tex: string, display: boolean) => string
  /** Highlighted HTML for code, or null for a language it doesn't know. */
  highlight?: (code: string, language: string) => string | null
}

const ENTITIES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
}
export const escapeHtml = (text: string) =>
  text.replace(/[&<>"']/g, (character) => ENTITIES[character])

const startOf = (src: string, marker: string) => {
  const index = src.indexOf(marker)
  return index < 0 ? undefined : index
}

/**
 * Markdown (GitHub's flavour) to HTML, with [[links]], $maths$ and
 * highlighted code. Raw HTML in a note is shown as text, not run; the
 * result is still sanitised before it's shown (see sanitize.ts).
 */
export function createRenderer(tools: RenderTools = {}) {
  let context: RenderContext = { noteFor: () => null, taskFor: () => null }
  // Checkboxes are numbered in order, so a click can tick the right one.
  let boxes = 0
  const marked = new Marked({ gfm: true, breaks: true })
  marked.use({
    extensions: [
      {
        name: 'wikilink',
        level: 'inline',
        start: (src) => startOf(src, '[['),
        tokenizer(src) {
          const match = /^\[\[([^\][\n]+?)\]\]/.exec(src)
          const link = match && parseLink(match[1])
          if (match && link) return { type: 'wikilink', raw: match[0], link }
        },
        renderer(token) {
          const { kind, target, label } = token.link as WikiLink
          const text = escapeHtml(label)
          if (kind === 'task') {
            const id = context.taskFor(target)
            return id
              ? `<a href="#" class="wikilink task" data-task="${escapeHtml(id)}">${text}</a>`
              : `<span class="wikilink missing" title="No task with this title">${text}</span>`
          }
          const id = context.noteFor(target)
          return id
            ? `<a href="/notes/${encodeURIComponent(id)}" class="wikilink" data-note="${escapeHtml(id)}">${text}</a>`
            : `<a href="#" class="wikilink missing" data-new-note="${escapeHtml(target)}" title="Create this note">${text}</a>`
        },
      },
      {
        name: 'blockMath',
        level: 'block',
        start: (src) => startOf(src, '$$'),
        tokenizer(src) {
          const match = /^\$\$([\s\S]+?)\$\$[^\S\n]*(?:\n|$)/.exec(src)
          if (match)
            return { type: 'blockMath', raw: match[0], text: match[1].trim() }
        },
        renderer(token) {
          return tools.math
            ? `<div class="math-block">${tools.math(token.text, true)}</div>`
            : `<pre class="math-source">${escapeHtml(token.text)}</pre>`
        },
      },
      {
        name: 'inlineMath',
        level: 'inline',
        start: (src) => startOf(src, '$'),
        tokenizer(src) {
          // Not "$5 and $10": maths doesn't start or end with a space, and
          // the closing $ isn't followed by a digit.
          const match = /^\$(?!\$)([^\s$](?:[^$\n]*?[^\s$])?)\$(?!\d)/.exec(src)
          if (match)
            return { type: 'inlineMath', raw: match[0], text: match[1] }
        },
        renderer(token) {
          return tools.math
            ? tools.math(token.text, false)
            : `<code class="math-source">${escapeHtml(token.text)}</code>`
        },
      },
    ],
    renderer: {
      listitem(item: Tokens.ListItem) {
        if (!item.task) return false
        return `<li class="task-item">${this.parser.parse(item.tokens)}</li>\n`
      },
      checkbox({ checked }: Tokens.Checkbox) {
        return `<input type="checkbox" data-box="${boxes++}" disabled${checked ? ' checked' : ''}> `
      },
      code({ text, lang }: Tokens.Code) {
        const language = (lang ?? '').trim().split(/\s+/)[0].toLowerCase()
        const highlighted = language ? tools.highlight?.(text, language) : null
        if (!highlighted) return false
        return `<pre><code class="hljs language-${escapeHtml(language)}">${highlighted}</code></pre>\n`
      },
      // Raw HTML in a note is text, not markup.
      html({ text }: Tokens.HTML | Tokens.Tag) {
        return escapeHtml(text)
      },
    },
  })
  return (markdown: string, links: RenderContext): string => {
    context = links
    boxes = 0
    return marked.parse(markdown, { async: false }) as string
  }
}
