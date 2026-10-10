import { describe, expect, it } from 'vitest'
import { formatSize, isPdf, titleFromFileName } from './file'
import { highlightsToMarkdown } from './note'
import { hits, readingOrder, toPageRects } from './rects'
import { pageText, type TextRun } from './text'
import type { Highlight } from '../types'

const page = { left: 100, top: 50, width: 600, height: 800 }

describe('selection rectangles', () => {
  it('turns a selection into page fractions, one rect per line', () => {
    const rects = toPageRects(
      [
        { left: 160, top: 130, width: 100, height: 20 },
        { left: 258, top: 131, width: 140, height: 19 }, // same line, next span
        { left: 160, top: 160, width: 300, height: 20 }, // next line
        { left: 160, top: 190, width: 0.5, height: 20 }, // sliver
        { left: 650, top: 200, width: 200, height: 20 }, // runs off the page
      ],
      page,
    )
    expect(rects).toEqual([
      { x: 0.1, y: 0.1, w: 0.3967, h: 0.025 },
      { x: 0.1, y: 0.1375, w: 0.5, h: 0.025 },
      { x: 0.9167, y: 0.1875, w: 0.0833, h: 0.025 },
    ])
  })

  it('finds what was tapped and sorts by reading order', () => {
    const rect = { x: 0.1, y: 0.1, w: 0.4, h: 0.02 }
    expect(hits([rect], { x: 0.2, y: 0.11 })).toBe(true)
    expect(hits([rect], { x: 0.6, y: 0.11 })).toBe(false)
    const items = [
      { id: 'c', page: 2, rects: [{ ...rect, y: 0.05 }] },
      { id: 'b', page: 1, rects: [{ ...rect, y: 0.5 }] },
      { id: 'a', page: 1, rects: [{ ...rect, y: 0.2 }] },
    ]
    expect(readingOrder(items).map((item) => item.id)).toEqual(['a', 'b', 'c'])
  })
})

describe('page text', () => {
  const run = (
    str: string,
    x: number,
    y: number,
    width: number,
    hasEOL = false,
  ): TextRun => ({
    str,
    transform: [10, 0, 0, 10, x, y],
    width,
    hasEOL,
  })

  it('joins runs into words and lines', () => {
    expect(
      pageText([
        run('Karn', 0, 700, 20),
        run('augh', 20.5, 700, 20), // a word in two pieces
        run('maps', 45, 700, 20, true), // after a gap; then a line break
        run('group', 0, 680, 25),
        run('ones', 0, 660, 20), // a new line without a break marker
      ]),
    ).toBe('Karnaugh maps group ones')
  })

  it('joins words hyphenated across lines', () => {
    expect(
      pageText([run('simpli-', 0, 700, 30, true), run('fied', 0, 680, 20)]),
    ).toBe('simplified')
  })
})

describe('files', () => {
  it('names a document after its file', () => {
    expect(titleFromFileName('Lecture_05-karnaugh  maps.PDF')).toBe(
      'Lecture 05 karnaugh maps',
    )
    expect(titleFromFileName('.pdf')).toBe('Untitled document')
  })

  it('recognises PDFs by their header', () => {
    const encode = (text: string) => new TextEncoder().encode(text)
    expect(isPdf(encode('%PDF-1.7\n...'))).toBe(true)
    expect(isPdf(encode('﻿  %PDF-2.0'))).toBe(true)
    expect(isPdf(encode('<html>not a pdf</html>'))).toBe(false)
  })

  it('says how big a file is', () => {
    expect(formatSize(830 * 1024)).toBe('830 KB')
    expect(formatSize(2.44 * 1024 * 1024)).toBe('2.4 MB')
    expect(formatSize(37.6 * 1024 * 1024)).toBe('38 MB')
  })
})

describe('highlights as a note', () => {
  const highlight = (
    page: number,
    y: number,
    quote: string,
    note = '',
  ): Highlight => ({
    id: quote,
    documentId: 'd',
    page,
    rects: [{ x: 0.1, y, w: 0.5, h: 0.02 }],
    quote,
    color: 'yellow',
    note,
    createdAt: '',
    updatedAt: '',
    deletedAt: null,
  })

  it('quotes each highlight with its page, in reading order', () => {
    expect(
      highlightsToMarkdown('Digital *Logic*', [
        highlight(3, 0.1, 'Later   quote'),
        highlight(1, 0.5, 'First quote', 'Check this in the lab.'),
      ]),
    ).toBe(
      [
        'Highlights from *Digital Logic*.',
        '> First quote\n> — p. 1\n\nCheck this in the lab.',
        '> Later quote\n> — p. 3',
      ].join('\n\n'),
    )
  })
})
