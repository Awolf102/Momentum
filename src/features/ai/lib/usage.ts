import type { ModelPrice, TokenUsage } from '../types'

export interface UsageTotals {
  inputTokens: number
  outputTokens: number
  requests: number
}

/** Token counts per month (`YYYY-MM`) per model (`provider:model`). */
export interface UsageData {
  months: Record<string, Record<string, UsageTotals>>
}

export const EMPTY_USAGE: UsageData = { months: {} }

/** How many months of history to keep. */
export const KEEP_MONTHS = 13

export function usageKey(provider: string, model: string): string {
  return `${provider}:${model}`
}

export function splitUsageKey(key: string): {
  provider: string
  model: string
} {
  const index = key.indexOf(':')
  return { provider: key.slice(0, index), model: key.slice(index + 1) }
}

export function monthOf(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

export function addUsage(
  data: UsageData,
  month: string,
  key: string,
  usage: TokenUsage,
): UsageData {
  const previous = data.months[month]?.[key] ?? {
    inputTokens: 0,
    outputTokens: 0,
    requests: 0,
  }
  const months = {
    ...data.months,
    [month]: {
      ...data.months[month],
      [key]: {
        inputTokens: previous.inputTokens + usage.inputTokens,
        outputTokens: previous.outputTokens + usage.outputTokens,
        requests: previous.requests + 1,
      },
    },
  }
  for (const old of Object.keys(months).sort().slice(0, -KEEP_MONTHS))
    delete months[old]
  return { months }
}

export function estimateCost(
  totals: UsageTotals,
  price: ModelPrice | undefined,
): number | undefined {
  if (!price) return undefined
  return (
    (totals.inputTokens * price.input + totals.outputTokens * price.output) /
    1_000_000
  )
}

export interface UsageRow extends UsageTotals {
  key: string
  provider: string
  model: string
  cost?: number
}

export interface MonthSummary {
  rows: UsageRow[]
  total: UsageTotals & {
    /** Cost of the models that have a price. */
    cost: number
    /** Whether some usage has no price, so the cost is incomplete. */
    unpriced: boolean
  }
}

export function summarizeMonth(
  data: UsageData,
  month: string,
  prices: Readonly<Record<string, ModelPrice>>,
): MonthSummary {
  const rows = Object.entries(data.months[month] ?? {})
    .map(([key, totals]) => ({
      key,
      ...splitUsageKey(key),
      ...totals,
      cost: estimateCost(totals, prices[key]),
    }))
    .sort(
      (a, b) =>
        b.inputTokens + b.outputTokens - (a.inputTokens + a.outputTokens),
    )
  const total = {
    inputTokens: 0,
    outputTokens: 0,
    requests: 0,
    cost: 0,
    unpriced: false,
  }
  for (const row of rows) {
    total.inputTokens += row.inputTokens
    total.outputTokens += row.outputTokens
    total.requests += row.requests
    if (row.cost === undefined) total.unpriced = true
    else total.cost += row.cost
  }
  return { rows, total }
}
