import { describe, expect, it } from 'vitest'
import {
  fold,
  highlight,
  indexDoc,
  search,
  snippet,
  type SearchDoc,
  type Segment,
} from './engine'

const doc = (
  key: string,
  title: string,
  text = '',
  updatedAt = '2026-10-01',
  boost = 0,
): SearchDoc => ({ key, title, text, updatedAt, boost })

const keys = (docs: SearchDoc[], query: string) =>
  search(docs.map(indexDoc), query).map(({ entry }) => entry.doc.key)

const marked = (segments: Segment[] | null) =>
  segments?.map((s) => (s.match ? `[${s.text}]` : s.text)).join('')

describe('search', () => {
  const docs = [
    doc('kmaps', 'Karnaugh maps', 'Group ones in powers of two.'),
    doc('boolean', 'Boolean algebra', 'Used before drawing Karnaugh maps.'),
    doc('geb', 'Gödel, Escher, Bach', 'A reading list item'),
    doc('lab', 'Lab report', 'due friday', '2026-10-05'),
    doc('lab-old', 'Lab report', 'last term', '2026-01-05', -1),
  ]

  it('folds case and accents', () => {
    expect(fold('Gödel ÉCOLE')).toBe('godel ecole')
    expect(keys(docs, 'godel')).toEqual(['geb'])
    expect(keys(docs, 'GÖDEL')).toEqual(['geb'])
  })

  it('matches the starts of words, every word', () => {
    expect(keys(docs, 'karn')).toEqual(['kmaps', 'boolean'])
    expect(keys(docs, 'augh')).toEqual([])
    expect(keys(docs, 'karnaugh powers')).toEqual(['kmaps'])
    expect(keys(docs, 'karnaugh nothing')).toEqual([])
  })

  it('ranks titles over text, then by boost and recency', () => {
    expect(keys(docs, 'maps')[0]).toBe('kmaps')
    expect(keys(docs, 'lab report')).toEqual(['lab', 'lab-old'])
  })

  it('breaks ties by kind before recency', () => {
    const tied = [
      { ...doc('inbox', 'Karnaugh maps', '', '2026-10-09'), order: 5 },
      { ...doc('note', 'Karnaugh maps', '', '2026-10-01'), order: 0 },
    ]
    expect(keys(tied, 'karnaugh')).toEqual(['note', 'inbox'])
  })

  it('needs a whole word for a single letter', () => {
    expect(keys([doc('a', 'A note'), doc('b', 'Another')], 'a')).toEqual(['a'])
  })

  it('ignores empty queries and punctuation', () => {
    expect(keys(docs, '   ')).toEqual([])
    expect(keys(docs, '"karnaugh"!')).toEqual(['kmaps', 'boolean'])
  })
})

describe('showing matches', () => {
  it('marks matched words in a title, accents and all', () => {
    expect(marked(highlight('Gödel, Escher, Bach', 'godel bach'))).toBe(
      '[Gödel], Escher, [Bach]',
    )
    expect(marked(highlight('Karnaugh maps', 'kar'))).toBe('[Kar]naugh maps')
  })

  it('cuts a snippet around the first matching line', () => {
    const text = [
      'First line without it.',
      `${'Lorem ipsum dolor sit amet '.repeat(4)}then the Karnaugh map groups ones in powers of two, ${'and so on '.repeat(10)}`,
    ].join('\n')
    const result = marked(snippet(text, 'karnaugh', 60))!
    expect(result.startsWith('…')).toBe(true)
    expect(result.endsWith('…')).toBe(true)
    expect(result).toContain('[Karnaugh] map')
    expect(result.length).toBeLessThan(80)
    expect(snippet(text, 'nothing')).toBeNull()
    expect(marked(snippet('Short line with Gödel.', 'godel'))).toBe(
      'Short line with [Gödel].',
    )
  })
})
