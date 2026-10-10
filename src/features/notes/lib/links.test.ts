import { describe, expect, it } from 'vitest'
import { excerpt } from './excerpt'
import { backlinks, extractLinks, renameLinks, withoutCode } from './links'

describe('links between notes', () => {
  it('finds note and task links, with shown text', () => {
    expect(
      extractLinks(
        'See [[Karnaugh maps]] and [[Boolean algebra|the algebra]]; due: [[task: Lab report]].',
      ),
    ).toEqual([
      { kind: 'note', target: 'Karnaugh maps', label: 'Karnaugh maps' },
      { kind: 'note', target: 'Boolean algebra', label: 'the algebra' },
      { kind: 'task', target: 'Lab report', label: 'Lab report' },
    ])
  })

  it('ignores links inside code', () => {
    const body = [
      'Real [[Link]]',
      '```js',
      'const a = "[[Not a link]]"',
      '```',
      'and `[[inline code]]` too',
    ].join('\n')
    expect(extractLinks(body).map((link) => link.target)).toEqual(['Link'])
    expect(withoutCode(body)).toHaveLength(body.length)
  })

  it('lists the notes that link here, with the line they do it on', () => {
    const notes = [
      { id: 'a', title: 'Adders', body: 'Built from [[logic gates]].\nMore.' },
      { id: 'b', title: 'Gates', body: 'Nothing here' },
      { id: 'c', title: 'Logic gates', body: 'Self [[Logic Gates]]' },
    ]
    expect(backlinks('Logic gates', notes)).toEqual([
      { id: 'a', context: 'Built from [[logic gates]].' },
    ])
  })

  it('follows a rename, keeping shown text and leaving code alone', () => {
    const body =
      'See [[Old name]] and [[old  NAME|this]].\n`[[Old name]]` stays.'
    expect(renameLinks(body, 'Old name', 'New name')).toBe(
      'See [[New name]] and [[New name|this]].\n`[[Old name]]` stays.',
    )
  })
})

describe('excerpts', () => {
  it('reads as plain text', () => {
    expect(
      excerpt(
        '# Heading\n\nSome **bold** and _soft_ text with [a link](https://x.y) and [[A note|alias]].\n\n- [ ] a task\n\n```\ncode\n```\n$e^x$ maths',
      ),
    ).toBe(
      'Heading · Some bold and soft text with a link and alias. · a task · e^x maths',
    )
    expect(excerpt('x'.repeat(200), 10)).toBe(`${'x'.repeat(10)}…`)
  })

  it('reads maths and tables as text', () => {
    expect(
      excerpt(
        'Near $a$: $e^x = 1 + x + \\frac{x^{2}}{2!} + \\dots$, so $\\overline{A} \\cdot \\pi$.',
      ),
    ).toBe('Near a: e^x = 1 + x + x^2/2! + …, so A · π.')
    expect(excerpt('It cost $5 and $10.')).toBe('It cost $5 and $10.')
    expect(
      excerpt('| Law | AND |\n|---|:---:|\n| Identity | $A \\cdot 1 = A$ |'),
    ).toBe('Law · AND · Identity · A · 1 = A')
  })
})
