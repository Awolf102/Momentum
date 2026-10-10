import { describe, expect, it } from 'vitest'
import {
  CHUNK_CHARS,
  chunkSegments,
  letterCount,
  MIN_LETTERS,
  sentences,
} from './chunk'
import { estimateTokens, hashText, planIndex } from './plan'
import { promptsFor } from './prompts'
import { meanVector, packRows, quantize, rowScore, TopK, unit } from './vectors'

const sentence = (n: number) =>
  `Sentence number ${n} explains one small idea about flip-flops and latches.`

describe('sentences', () => {
  it('splits after full stops, questions and lines, keeping punctuation', () => {
    expect(
      sentences('A latch holds a bit. Does it? “Yes.” Then\nnext line'),
    ).toEqual([
      'A latch holds a bit.',
      'Does it?',
      '“Yes.”',
      'Then',
      'next line',
    ])
  })
})

describe('chunkSegments', () => {
  it('packs whole sentences into passages no longer than the limit', () => {
    const text = Array.from({ length: 40 }, (_, n) => sentence(n)).join(' ')
    const chunks = chunkSegments([{ page: 3, text }])
    expect(chunks.length).toBeGreaterThan(2)
    for (const chunk of chunks) {
      expect(chunk.page).toBe(3)
      expect(chunk.text.length).toBeLessThanOrEqual(CHUNK_CHARS)
      expect(chunk.text).toMatch(/^Sentence number \d+/)
      expect(chunk.text).toMatch(/latches\.$/)
    }
  })

  it('starts each passage with the last sentence of the one before', () => {
    const text = Array.from({ length: 30 }, (_, n) => sentence(n)).join(' ')
    const [first, second] = chunkSegments([{ page: null, text }])
    const last = sentences(first.text).at(-1)!
    expect(second.text.startsWith(last)).toBe(true)
  })

  it('never joins pages, and skips pages with almost no words', () => {
    const chunks = chunkSegments([
      { page: 1, text: 'Lecture 4: sequential logic and why state matters.' },
      { page: 2, text: '42' },
      { page: 3, text: 'Figure 3' },
      { page: 4, text: 'A register is a row of flip-flops sharing a clock.' },
    ])
    expect(chunks.map((chunk) => chunk.page)).toEqual([1, 4])
  })

  it('cuts sentences longer than a passage between words', () => {
    const long = Array.from({ length: 400 }, (_, n) => `word${n}`).join(' ')
    const chunks = chunkSegments([{ page: null, text: long }])
    expect(chunks.length).toBeGreaterThan(1)
    for (const chunk of chunks)
      expect(chunk.text.length).toBeLessThanOrEqual(CHUNK_CHARS)
    expect(chunks.map((chunk) => chunk.text).join(' ')).toContain('word399')
  })

  it('counts letters and digits in any script', () => {
    expect(letterCount('Ünïcode 字 42 — !')).toBe(10)
    expect(letterCount('x'.repeat(MIN_LETTERS))).toBe(MIN_LETTERS)
  })
})

describe('vectors', () => {
  it('quantizes to 8 bits with nearly the same similarities', () => {
    const a = unit([0.3, -0.2, 0.9, 0.1, -0.5, 0.05])
    const b = unit([0.25, -0.1, 0.8, 0.3, -0.4, 0.0])
    const exact = a.reduce((sum, value, i) => sum + value * b[i], 0)
    const rows = packRows([b])
    expect(rowScore(rows, 0, a)).toBeCloseTo(exact, 2)
    const { values, scale } = quantize(a)
    expect(Math.max(...Array.from(values, Math.abs))).toBe(127)
    expect(scale).toBeGreaterThan(0)
  })

  it('averages rows into a unit vector', () => {
    const rows = packRows([
      [1, 0, 0],
      [0, 1, 0],
    ])
    const mean = meanVector(rows)
    expect(mean[0]).toBeCloseTo(Math.SQRT1_2, 2)
    expect(mean[1]).toBeCloseTo(Math.SQRT1_2, 2)
    expect(Math.hypot(...mean)).toBeCloseTo(1, 5)
  })

  it('keeps the best few items in order', () => {
    const top = new TopK<string>(3)
    for (const [item, score] of [
      ['a', 0.1],
      ['b', 0.9],
      ['c', 0.5],
      ['d', 0.7],
      ['e', 0.2],
    ] as const)
      top.add(item, score)
    expect(top.best().map(({ item }) => item)).toEqual(['b', 'd', 'c'])
  })
})

describe('planIndex', () => {
  const sources = [
    { key: 'note:a', hash: '1' },
    { key: 'note:b', hash: '2' },
    { key: 'document:c', hash: '3' },
  ]

  it('embeds what is new, changed or from another model, and removes what is gone', () => {
    const plan = planIndex(
      sources,
      [
        { key: 'note:a', hash: '1', space: 'openai:small' },
        { key: 'note:b', hash: 'old', space: 'openai:small' },
        { key: 'document:c', hash: '3', space: 'browser:mini' },
        { key: 'note:gone', hash: '9', space: 'openai:small' },
      ],
      'openai:small',
    )
    expect(plan.current.map((source) => source.key)).toEqual(['note:a'])
    expect(plan.embed.map((source) => source.key)).toEqual([
      'note:b',
      'document:c',
    ])
    expect(plan.remove).toEqual(['note:gone'])
  })

  it('leaves out (and removes) what is kept out of the index', () => {
    const plan = planIndex(
      sources,
      [{ key: 'note:a', hash: '1', space: 's' }],
      's',
      new Set(['note:a', 'note:b']),
    )
    expect(plan.embed.map((source) => source.key)).toEqual(['document:c'])
    expect(plan.remove).toEqual(['note:a'])
  })

  it('fingerprints text stably, and estimates tokens', () => {
    expect(hashText('hello')).toBe(hashText('hello'))
    expect(hashText('hello')).not.toBe(hashText('hellp'))
    expect(estimateTokens(10)).toBe(3)
  })
})

describe('promptsFor', () => {
  it('knows the models that want to be told searches from passages', () => {
    expect(promptsFor('nomic-embed-text')).toEqual({
      query: 'search_query: ',
      passage: 'search_document: ',
    })
    expect(promptsFor('intfloat/multilingual-e5-small').query).toBe('query: ')
    expect(promptsFor('mxbai-embed-large:latest').query).toMatch(
      /^Represent this sentence/,
    )
    expect(promptsFor('BAAI/bge-small-en-v1.5').query).toMatch(/^Represent/)
    expect(promptsFor('snowflake-arctic-embed2').query).toBe('query: ')
    expect(promptsFor('snowflake-arctic-embed:s').query).toMatch(/^Represent/)
  })

  it('adds nothing for models that need nothing', () => {
    for (const model of [
      'text-embedding-3-small',
      'all-MiniLM-L6-v2',
      'bge-m3',
      'gte-base',
    ])
      expect(promptsFor(model)).toEqual({ query: '', passage: '' })
  })
})
