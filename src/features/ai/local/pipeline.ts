/**
 * Turning texts into vectors with a BERT-style model: token ids in, one
 * hidden state per token out, pooled into a single unit-length vector per
 * text. Pure, so it's tested without a browser.
 */

export interface Encoder {
  encode(text: string): { ids: number[] }
}

/** Texts as token ids, each cut to `maxTokens` (keeping its end marker). */
export function encodeTexts(
  tokenizer: Encoder,
  texts: readonly string[],
  maxTokens: number,
): number[][] {
  return texts.map((text) => {
    const { ids } = tokenizer.encode(text)
    return ids.length > maxTokens
      ? [...ids.slice(0, maxTokens - 1), ids[ids.length - 1]]
      : ids
  })
}

export interface Batch {
  ids: BigInt64Array
  mask: BigInt64Array
  types: BigInt64Array
  /** [texts, tokens per text after padding] */
  shape: [number, number]
  /** Each text's real token count. */
  lengths: number[]
}

/** Rows of token ids as one batch, padded at the end to the longest. */
export function toBatch(rows: readonly number[][]): Batch {
  const longest = Math.max(1, ...rows.map((row) => row.length))
  const size = rows.length * longest
  const ids = new BigInt64Array(size)
  const mask = new BigInt64Array(size)
  rows.forEach((row, i) =>
    row.forEach((id, j) => {
      ids[i * longest + j] = BigInt(id)
      mask[i * longest + j] = 1n
    }),
  )
  return {
    ids,
    mask,
    types: new BigInt64Array(size),
    shape: [rows.length, longest],
    lengths: rows.map((row) => row.length),
  }
}

/**
 * Groups texts of similar length into batches (less padding to compute),
 * each at most `size` texts. Returns indexes into `rows`.
 */
export function batchesByLength(
  rows: readonly number[][],
  size: number,
): number[][] {
  const order = rows
    .map((row, index) => ({ index, length: row.length }))
    .sort((a, b) => a.length - b.length)
    .map(({ index }) => index)
  const batches: number[][] = []
  for (let start = 0; start < order.length; start += size)
    batches.push(order.slice(start, start + size))
  return batches
}

/** Scales a vector to length 1, in place. */
export function normalize(vector: Float32Array): Float32Array {
  let sum = 0
  for (const value of vector) sum += value * value
  const length = Math.sqrt(sum)
  if (length > 0) for (let i = 0; i < vector.length; i++) vector[i] /= length
  return vector
}

/**
 * One unit-length vector per text from the model's last hidden state
 * (`[texts, tokens, dims]`): the mean of its tokens' states, or the first
 * token's.
 */
export function pool(
  hidden: Float32Array,
  dims: readonly number[],
  lengths: readonly number[],
  pooling: 'mean' | 'cls',
): Float32Array {
  const [count, tokens, size] = dims
  const out = new Float32Array(count * size)
  for (let i = 0; i < count; i++) {
    const vector = out.subarray(i * size, (i + 1) * size)
    const start = i * tokens * size
    if (pooling === 'cls') {
      vector.set(hidden.subarray(start, start + size))
    } else {
      const length = Math.max(1, lengths[i])
      for (let j = 0; j < length; j++) {
        const base = start + j * size
        for (let k = 0; k < size; k++) vector[k] += hidden[base + k]
      }
      for (let k = 0; k < size; k++) vector[k] /= length
    }
    normalize(vector)
  }
  return out
}
