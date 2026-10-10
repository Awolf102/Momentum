import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  batchesByLength,
  encodeTexts,
  normalize,
  pool,
  toBatch,
  type Encoder,
} from './pipeline'

/** Splits on spaces: [CLS]=101, each word's length, [SEP]=102. */
const fakeTokenizer: Encoder = {
  encode: (text) => ({
    ids: [101, ...text.split(' ').map((word) => word.length), 102],
  }),
}

describe('encodeTexts', () => {
  it('cuts long texts to the limit, keeping the end marker', () => {
    const [short, long] = encodeTexts(
      fakeTokenizer,
      ['a bb', 'a bb ccc dddd eeeee'],
      4,
    )
    expect(short).toEqual([101, 1, 2, 102])
    expect(long).toEqual([101, 1, 2, 102])
  })
})

describe('toBatch', () => {
  it('pads rows to the longest, masking the padding', () => {
    const batch = toBatch([
      [101, 7, 102],
      [101, 102],
    ])
    expect(batch.shape).toEqual([2, 3])
    expect(Array.from(batch.ids)).toEqual([101n, 7n, 102n, 101n, 102n, 0n])
    expect(Array.from(batch.mask)).toEqual([1n, 1n, 1n, 1n, 1n, 0n])
    expect(batch.lengths).toEqual([3, 2])
    expect(batch.types.every((value) => value === 0n)).toBe(true)
  })
})

describe('batchesByLength', () => {
  it('groups texts of similar length', () => {
    const rows = [[1, 1, 1, 1], [1], [1, 1, 1], [1, 1]]
    expect(batchesByLength(rows, 2)).toEqual([
      [1, 3],
      [2, 0],
    ])
  })
})

describe('pool', () => {
  // Two texts, three token slots, two numbers per token.
  const hidden = new Float32Array([
    // text 1: tokens (1,0) (0,1) and padding (9,9)
    1, 0, 0, 1, 9, 9,
    // text 2: tokens (3,4) (3,4) (3,4)
    3, 4, 3, 4, 3, 4,
  ])

  it('averages real tokens (not padding) into unit vectors', () => {
    const vectors = pool(hidden, [2, 3, 2], [2, 3], 'mean')
    expect(vectors[0]).toBeCloseTo(Math.SQRT1_2)
    expect(vectors[1]).toBeCloseTo(Math.SQRT1_2)
    expect(vectors[2]).toBeCloseTo(0.6)
    expect(vectors[3]).toBeCloseTo(0.8)
  })

  it('or takes the first token', () => {
    const vectors = pool(hidden, [2, 3, 2], [2, 3], 'cls')
    expect(Array.from(vectors)).toEqual([
      1, 0, 0.6000000238418579, 0.800000011920929,
    ])
  })

  it('leaves a zero vector alone', () => {
    expect(Array.from(normalize(new Float32Array([0, 0])))).toEqual([0, 0])
  })
})

/**
 * With the real model's files (MOMENTUM_TEST_MODEL_DIR pointing at a copy of
 * Xenova/all-MiniLM-L6-v2), checks the whole pipeline gives sensible
 * similarities. Skipped without them: the model isn't in the repository.
 */
const modelDir = process.env.MOMENTUM_TEST_MODEL_DIR
describe.skipIf(!modelDir)('with the real model', () => {
  it('puts texts about the same thing close together', async () => {
    const ort = await import('onnxruntime-web')
    const { Tokenizer } = await import('@huggingface/tokenizers')
    const dir = modelDir!
    const tokenizer = new Tokenizer(
      JSON.parse(readFileSync(join(dir, 'tokenizer.json'), 'utf8')),
      JSON.parse(readFileSync(join(dir, 'tokenizer_config.json'), 'utf8')),
    )
    ort.env.wasm.numThreads = 1
    const session = await ort.InferenceSession.create(
      readFileSync(join(dir, 'onnx/model_quantized.onnx')),
    )
    const texts = [
      'Karnaugh maps simplify Boolean expressions.',
      'How do I minimise a logic function?',
      'Photosynthesis happens in chloroplasts.',
      'A man is eating food.',
      'A man is eating a piece of bread.',
    ]
    const batch = toBatch(encodeTexts(tokenizer, texts, 256))
    const output = await session.run({
      input_ids: new ort.Tensor('int64', batch.ids, batch.shape),
      attention_mask: new ort.Tensor('int64', batch.mask, batch.shape),
      token_type_ids: new ort.Tensor('int64', batch.types, batch.shape),
    })
    const hidden = output.last_hidden_state
    const vectors = pool(
      hidden.data as Float32Array,
      hidden.dims,
      batch.lengths,
      'mean',
    )
    const dims = hidden.dims[2]
    const similarity = (a: number, b: number) => {
      let sum = 0
      for (let i = 0; i < dims; i++)
        sum += vectors[a * dims + i] * vectors[b * dims + i]
      return sum
    }
    expect(dims).toBe(384)
    expect(similarity(0, 1)).toBeGreaterThan(similarity(0, 2) + 0.2)
    expect(similarity(3, 4)).toBeGreaterThan(0.7)
    expect(similarity(3, 0)).toBeLessThan(0.2)
  })
})
