import { withoutCode } from './links'

// TeX commands with a plain-text look-alike.
const SYMBOLS: Record<string, string> = {
  cdot: '·',
  times: '×',
  div: '÷',
  pm: '±',
  dots: '…',
  ldots: '…',
  cdots: '…',
  infty: '∞',
  leq: '≤',
  le: '≤',
  geq: '≥',
  ge: '≥',
  neq: '≠',
  ne: '≠',
  approx: '≈',
  to: '→',
  rightarrow: '→',
  implies: '⇒',
  sum: 'Σ',
  prod: 'Π',
  int: '∫',
  sqrt: '√',
  partial: '∂',
  nabla: '∇',
  oplus: '⊕',
  land: '∧',
  wedge: '∧',
  lor: '∨',
  vee: '∨',
  neg: '¬',
  in: '∈',
  alpha: 'α',
  beta: 'β',
  gamma: 'γ',
  delta: 'δ',
  epsilon: 'ε',
  theta: 'θ',
  lambda: 'λ',
  mu: 'μ',
  pi: 'π',
  rho: 'ρ',
  sigma: 'σ',
  tau: 'τ',
  phi: 'φ',
  omega: 'ω',
  Delta: 'Δ',
  Sigma: 'Σ',
  Omega: 'Ω',
}

/** Inline TeX as readable text: "\frac{x^2}{2!}" → "x^2/2!". */
export function plainMath(tex: string): string {
  let text = tex
  // Innermost groups first, a few levels deep.
  for (let pass = 0; pass < 3; pass++) {
    text = text
      .replace(/\\frac\{([^{}]*)\}\{([^{}]*)\}/g, '$1/$2')
      .replace(
        /\\(?:overline|bar|hat|vec|tilde|mathbf|mathrm|mathit|text|operatorname)\{([^{}]*)\}/g,
        '$1',
      )
      .replace(/([_^])\{([^{}]*)\}/g, '$1$2')
  }
  return text
    .replace(/\\([A-Za-z]+)/g, (_, name: string) => SYMBOLS[name] ?? name)
    .replace(/\\[,;:! ]/g, ' ')
    .replace(/[{}]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * A note as plain lines: markdown marks, links and maths reduced to their
 * words, display maths left out, table rows as their cells. Code is left out
 * too, unless `code` is "keep" (for search: its text, without the fences).
 */
export function plainLines(
  markdown: string,
  { code = 'drop' }: { code?: 'drop' | 'keep' } = {},
): string[] {
  const source =
    code === 'keep'
      ? markdown
          .replace(/^\s{0,3}(```|~~~).*$/gm, '')
          .replace(/`([^`\n]+)`/g, '$1')
      : withoutCode(markdown)
  return (
    source
      .replace(/\$\$[\s\S]*?\$\$/g, ' ')
      // Inline maths by the renderer's rule, so "$5 and $10" stays money.
      .replace(
        /\$(?!\$)([^\s$](?:[^$\n]*?[^\s$])?)\$(?!\d)/g,
        (_, tex: string) => plainMath(tex),
      )
      .replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, '$2')
      .replace(/\[\[(?:task:\s*)?([^\]]+)\]\]/gi, '$1')
      .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
      .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
      .split('\n')
      .flatMap((line) => {
        // A table's divider row says nothing; its other rows are their cells.
        if (/^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(line))
          return []
        const cells = line.trim().startsWith('|')
          ? line
              .split('|')
              .map((cell) => cell.trim())
              .filter(Boolean)
              .join(' · ')
          : line
        const text = cells
          .replace(/^\s{0,3}(#{1,6}|>|[-*+]|\d+[.)])\s+(\[[ xX]\]\s+)?/, '')
          .replace(/[*_~]{1,3}([^*_~\n]+)[*_~]{1,3}/g, '$1')
          .replace(/\s+/g, ' ')
          .trim()
        return text ? [text] : []
      })
  )
}

/**
 * A note's opening words as plain text, for lists and previews, its lines
 * (headings, list items, table rows) kept apart by dots.
 */
export function excerpt(markdown: string, length = 160): string {
  const text = plainLines(markdown).join(' · ')
  const characters = Array.from(text)
  return characters.length > length
    ? `${characters.slice(0, length).join('').trimEnd()}…`
    : text
}
