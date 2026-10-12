/** WebLLM's progress as it loads a model, as it reports it. */
export interface ProgressReport {
  progress: number
  text: string
}

/** How far a load has got: downloading the weights, or putting them on the GPU. */
export interface LoadProgress {
  phase: 'download' | 'load'
  /** 0 to 1. */
  fraction: number
  /** For a download: bytes so far, and in all, when WebLLM says. */
  loaded?: number
  total?: number
}

/** WebLLM reports progress as a sentence: this reads it. */
export function readProgress(report: ProgressReport): LoadProgress | null {
  const fraction = Math.max(0, Math.min(1, report.progress))
  if (/^Loading model from cache/.test(report.text))
    return { phase: 'load', fraction }
  if (/^(Fetching param cache|Start to fetch params)/.test(report.text)) {
    const megabytes = /(\d+)MB fetched/.exec(report.text)
    const loaded = megabytes ? Number(megabytes[1]) * 1024 * 1024 : undefined
    return {
      phase: 'download',
      fraction,
      loaded,
      total: loaded && fraction > 0 ? Math.round(loaded / fraction) : undefined,
    }
  }
  return null
}
