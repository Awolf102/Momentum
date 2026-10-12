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

/**
 * Model-list entries that suit a task: embedding models for embeddings,
 * transcribers (Whisper, the GPT transcribe models) for transcription, the
 * rest for chat.
 */
export function modelsForTask<T extends { id: string }>(
  models: readonly T[],
  task: 'chat' | 'embeddings' | 'transcription',
): T[] {
  const isEmbedding = (model: T) => /embed/i.test(model.id)
  const isTranscriber = (model: T) => /whisper|transcri/i.test(model.id)
  if (task === 'chat')
    return models.filter(
      (model) => !isEmbedding(model) && !isTranscriber(model),
    )
  const matching = models.filter(
    task === 'embeddings' ? isEmbedding : isTranscriber,
  )
  return matching.length > 0 ? matching : [...models]
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

/** Time a reply has taken so far: "8 s", "1 min 05 s". */
export function formatElapsed(ms: number): string {
  const seconds = Math.max(0, Math.floor(ms / 1000))
  if (seconds < 60) return `${seconds} s`
  return `${Math.floor(seconds / 60)} min ${String(seconds % 60).padStart(2, '0')} s`
}

/** A size on disk or in memory: "412 MB", "1.1 GB". */
export function formatSize(bytes: number): string {
  if (bytes < 1_000_000_000) return formatMegabytes(bytes)
  const gigabytes = bytes / 1_000_000_000
  return `${gigabytes < 10 ? gigabytes.toFixed(1) : Math.round(gigabytes)} GB`
}
