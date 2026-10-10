const compact = new Intl.NumberFormat(undefined, {
  notation: 'compact',
  maximumFractionDigits: 1,
})

export function formatTokens(count: number): string {
  return compact.format(count)
}

/** Costs in US dollars (the currency providers price in), with sub-cent detail. */
export function formatCost(value: number): string {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: value > 0 && value < 0.01 ? 4 : 2,
  }).format(value)
}

export function formatMonth(month: string): string {
  const [year, monthIndex] = month.split('-').map(Number)
  return new Date(year, monthIndex - 1, 1).toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
  })
}

export function formatLatency(ms: number): string {
  return ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(1)} s`
}

/** Model-list entries that suit a task: embedding models for embeddings, the rest for chat. */
export function modelsForTask<T extends { id: string }>(
  models: readonly T[],
  task: 'chat' | 'embeddings',
): T[] {
  const isEmbedding = (model: T) => /embed/i.test(model.id)
  if (task === 'chat') return models.filter((model) => !isEmbedding(model))
  const embedding = models.filter(isEmbedding)
  return embedding.length > 0 ? embedding : [...models]
}

/** A download's size, e.g. "38 MB". */
export function formatMegabytes(bytes: number): string {
  const megabytes = bytes / 1_000_000
  return `${megabytes < 10 ? megabytes.toFixed(1) : Math.round(megabytes)} MB`
}

/** About how many tokens, e.g. "about 96,000 tokens". */
export function formatTokenEstimate(count: number): string {
  const rounded =
    count < 1000
      ? Math.max(10, Math.round(count / 10) * 10)
      : Math.round(count / 1000) * 1000
  return `about ${rounded.toLocaleString()} tokens`
}
