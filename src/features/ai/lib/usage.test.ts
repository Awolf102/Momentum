import { describe, expect, it } from 'vitest'
import {
  addUsage,
  EMPTY_USAGE,
  estimateCost,
  KEEP_MONTHS,
  monthOf,
  summarizeMonth,
  usageKey,
} from './usage'

describe('usage', () => {
  it('adds up tokens and requests per model per month', () => {
    let data = addUsage(EMPTY_USAGE, '2026-10', 'anthropic:claude-test', {
      inputTokens: 100,
      outputTokens: 20,
    })
    data = addUsage(data, '2026-10', 'anthropic:claude-test', {
      inputTokens: 50,
      outputTokens: 5,
    })
    expect(data.months['2026-10']['anthropic:claude-test']).toEqual({
      inputTokens: 150,
      outputTokens: 25,
      requests: 2,
    })
  })

  it('keeps only the most recent months', () => {
    let data = EMPTY_USAGE
    // Twenty months, January 2026 to August 2027.
    for (let index = 0; index < 20; index++) {
      data = addUsage(
        data,
        monthOf(new Date(2026, index, 1)),
        'openai:gpt-test',
        { inputTokens: 1, outputTokens: 1 },
      )
    }
    const months = Object.keys(data.months).sort()
    expect(months).toHaveLength(KEEP_MONTHS)
    expect(months.at(-1)).toBe('2027-08')
  })

  it('estimates cost from prices per million tokens', () => {
    expect(
      estimateCost(
        { inputTokens: 2_000_000, outputTokens: 500_000, requests: 3 },
        { input: 3, output: 15 },
      ),
    ).toBe(13.5)
    expect(
      estimateCost({ inputTokens: 1, outputTokens: 1, requests: 1 }, undefined),
    ).toBeUndefined()
  })

  it('summarises a month, flagging models without a price', () => {
    let data = addUsage(
      EMPTY_USAGE,
      '2026-10',
      usageKey('anthropic', 'claude-test'),
      { inputTokens: 1_000_000, outputTokens: 0 },
    )
    data = addUsage(data, '2026-10', usageKey('compatible', 'llama:8b'), {
      inputTokens: 10,
      outputTokens: 10,
    })
    const summary = summarizeMonth(data, '2026-10', {
      'anthropic:claude-test': { input: 3, output: 15 },
    })
    expect(summary.rows.map((row) => row.key)).toEqual([
      'anthropic:claude-test',
      'compatible:llama:8b',
    ])
    expect(summary.rows[1]).toMatchObject({
      provider: 'compatible',
      model: 'llama:8b',
      cost: undefined,
    })
    expect(summary.total).toMatchObject({
      inputTokens: 1_000_010,
      requests: 2,
      cost: 3,
      unpriced: true,
    })
  })

  it('names months in local time', () => {
    expect(monthOf(new Date(2026, 9, 31, 23, 30))).toBe('2026-10')
  })
})
