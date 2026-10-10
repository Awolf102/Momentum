import { describe, expect, it } from 'vitest'
import {
  fitSource,
  jsonItems,
  jsonObject,
  sourceBody,
  spreadOrder,
  spreadSources,
  type SourceText,
} from './material'

const lecture: SourceText = {
  kind: 'document',
  title: 'Lecture 5',
  parts: [
    { page: 1, text: 'a'.repeat(10) },
    { page: 2, text: '   ' },
    { page: 3, text: 'b'.repeat(10) },
    { page: 4, text: 'c'.repeat(10) },
  ],
}

const pages = (count: number, size = 10): SourceText => ({
  kind: 'document',
  title: 'Book',
  parts: Array.from({ length: count }, (_, index) => ({
    page: index + 1,
    text: String(index % 10).repeat(size),
  })),
})

const sentPages = (source: SourceText) => source.parts.map((part) => part.page)

describe('the text sent from one source', () => {
  it('is whole pages, up to the limit, counting only what goes', () => {
    expect(fitSource(lecture, 25)).toEqual({
      source: {
        ...lecture,
        parts: [
          { page: 1, text: 'a'.repeat(10) },
          { page: 3, text: 'b'.repeat(10) },
        ],
      },
      cut: true,
      characters: 20,
    })
    expect(fitSource(lecture, 100)).toMatchObject({
      cut: false,
      characters: 30,
    })
    // A first page longer than the limit is shortened rather than lost.
    expect(fitSource(lecture, 4)).toEqual({
      source: { ...lecture, parts: [{ page: 1, text: 'aaaa' }] },
      cut: true,
      characters: 4,
    })
  })

  it('marks each page', () => {
    expect(sourceBody(fitSource(lecture).source)).toBe(
      `[page 1]\n${'a'.repeat(10)}\n\n[page 3]\n${'b'.repeat(10)}\n\n[page 4]\n${'c'.repeat(10)}`,
    )
    expect(
      sourceBody({
        kind: 'note',
        title: 'Gates',
        parts: [{ page: null, text: 'NAND' }],
      }),
    ).toBe('NAND')
  })
})

describe('the text sent from several sources', () => {
  it('covers positions evenly, each once', () => {
    expect(spreadOrder(0)).toEqual([])
    expect(spreadOrder(1)).toEqual([0])
    expect(spreadOrder(5)).toEqual([0, 2, 1, 3, 4])
    const order = spreadOrder(37)
    expect([...order].sort((a, b) => a - b)).toEqual(
      Array.from({ length: 37 }, (_, index) => index),
    )
    // The first few reach all through, not just the start.
    expect(Math.max(...order.slice(0, 4))).toBeGreaterThan(25)
  })

  it('sends everything when it fits', () => {
    const fitted = spreadSources([lecture], 100)
    expect(fitted.cut).toBe(false)
    expect(fitted.characters).toBe(30)
    expect(sentPages(fitted.sources[0])).toEqual([1, 3, 4])
  })

  it('takes pages from all through, when they don’t all fit', () => {
    const fitted = spreadSources([pages(10)], 50)
    expect(fitted).toMatchObject({ cut: true, characters: 50 })
    expect(sentPages(fitted.sources[0])).toEqual([1, 2, 3, 6, 8])
  })

  it('shares the room between sources, keeping their order', () => {
    const note: SourceText = {
      kind: 'note',
      title: 'Gates',
      parts: [{ page: null, text: 'n'.repeat(30) }],
    }
    const fitted = spreadSources([note, pages(4)], 40)
    expect(fitted.cut).toBe(true)
    expect(fitted.sources.map((source) => source.title)).toEqual([
      'Gates',
      'Book',
    ])
    expect(fitted.sources[0].parts).toEqual([
      { page: null, text: 'n'.repeat(30) },
    ])
    expect(sentPages(fitted.sources[1])).toEqual([2])
    // A source nothing fitted from is still there, empty.
    expect(spreadSources([pages(3, 50), note], 120).sources[1].parts).toEqual(
      [],
    )
  })

  it('shortens a note too long to fit, at a word break', () => {
    const long: SourceText = {
      kind: 'note',
      title: 'Essay',
      parts: [{ page: null, text: 'word '.repeat(600) }],
    }
    const fitted = spreadSources([long], 1203)
    const [part] = fitted.sources[0].parts
    expect(fitted.cut).toBe(true)
    expect(part.text.length).toBeLessThanOrEqual(1203)
    expect(part.text.length).toBeGreaterThan(1100)
    expect(part.text.endsWith('word')).toBe(true)
  })
})

describe('reading a reply', () => {
  it('finds a list’s objects, with or without words around it', () => {
    expect(jsonItems('```json\n[{"a":1},{"b":2}]\n```')).toEqual([
      { a: 1 },
      { b: 2 },
    ])
    expect(jsonItems('See [1] below.\n[{"a":1}]')).toEqual([{ a: 1 }])
    expect(jsonItems('No list here.')).toEqual([])
  })

  it('keeps the whole objects of a reply that was cut off', () => {
    expect(
      jsonItems('[{"a":1,"list":[1,2]},{"b":"x}\\"]"},{"c":[{"d"'),
    ).toEqual([{ a: 1, list: [1, 2] }, { b: 'x}"]' }])
  })

  it('finds an object, with or without words around it', () => {
    expect(jsonObject('```json\n{"mark":"right"}\n```')).toEqual({
      mark: 'right',
    })
    expect(jsonObject('I think {this} is {"mark": "partly"}')).toEqual({
      mark: 'partly',
    })
    expect(jsonObject('[1, 2]')).toBeNull()
  })
})
