/**
 * Vectors are stored as 8-bit steps of their largest value: a quarter of
 * the space of 32-bit floats, with practically the same ranking.
 */
export interface Quantized {
  values: Int8Array
  scale: number
}

/** A vector scaled to length 1, as 32-bit floats. */
export function unit(vector: ArrayLike<number>): Float32Array {
  const result = Float32Array.from(vector)
  let sum = 0
  for (const value of result) sum += value * value
  const length = Math.sqrt(sum)
  if (length > 0) for (let i = 0; i < result.length; i++) result[i] /= length
  return result
}

/** A unit-length vector in 8-bit steps. */
export function quantize(vector: ArrayLike<number>): Quantized {
  const scaled = unit(vector)
  let largest = 0
  for (const value of scaled) largest = Math.max(largest, Math.abs(value))
  const scale = largest / 127 || 1
  const values = new Int8Array(scaled.length)
  for (let i = 0; i < scaled.length; i++)
    values[i] = Math.round(scaled[i] / scale)
  return { values, scale }
}

/** Many quantized vectors of one size, packed one after another. */
export interface VectorRows {
  dims: number
  values: Int8Array
  scales: Float32Array
}

export function packRows(vectors: readonly ArrayLike<number>[]): VectorRows {
  const dims = vectors[0]?.length ?? 0
  const values = new Int8Array(vectors.length * dims)
  const scales = new Float32Array(vectors.length)
  vectors.forEach((vector, row) => {
    const quantized = quantize(vector)
    values.set(quantized.values, row * dims)
    scales[row] = quantized.scale
  })
  return { dims, values, scales }
}

/** The cosine similarity of a unit query and one stored row. */
export function rowScore(
  rows: VectorRows,
  row: number,
  query: Float32Array,
): number {
  const { dims, values } = rows
  const start = row * dims
  let sum = 0
  for (let i = 0; i < dims; i++) sum += values[start + i] * query[i]
  return sum * rows.scales[row]
}

/** A row's vector as unit-length floats again. */
export function rowVector(rows: VectorRows, row: number): Float32Array {
  const { dims, values } = rows
  const vector = new Float32Array(dims)
  for (let i = 0; i < dims; i++)
    vector[i] = values[row * dims + i] * rows.scales[row]
  return vector
}

/** The average direction of several rows, as a unit vector. */
export function meanVector(rows: VectorRows): Float32Array {
  const count = rows.scales.length
  const mean = new Float32Array(rows.dims)
  for (let row = 0; row < count; row++) {
    const vector = rowVector(rows, row)
    for (let i = 0; i < rows.dims; i++) mean[i] += vector[i]
  }
  return unit(mean)
}

/** Keeps the `size` best-scoring items seen. */
export class TopK<T> {
  private readonly items: Array<{ item: T; score: number }> = []
  private readonly size: number

  constructor(size: number) {
    this.size = size
  }

  /** The score an item needs to get in. */
  get bar(): number {
    return this.items.length < this.size
      ? -Infinity
      : this.items[this.items.length - 1].score
  }

  add(item: T, score: number): void {
    if (score <= this.bar) return
    let index = this.items.length
    while (index > 0 && this.items[index - 1].score < score) index--
    this.items.splice(index, 0, { item, score })
    if (this.items.length > this.size) this.items.pop()
  }

  best(): Array<{ item: T; score: number }> {
    return [...this.items]
  }
}
