import { describe, expect, it } from 'vitest'
import { cleanLine, MAX_LINE_LENGTH } from './text'

describe('cleanLine', () => {
  it('makes one tidy line', () => {
    expect(cleanLine('  Two Calculus sets\n\nand   the lab ')).toBe(
      'Two Calculus sets and the lab',
    )
  })

  it('cuts long text without splitting an emoji', () => {
    const text = `${'a'.repeat(MAX_LINE_LENGTH - 1)}🔥🔥`
    const line = cleanLine(text)
    expect(Array.from(line)).toHaveLength(MAX_LINE_LENGTH)
    expect(line.endsWith('🔥')).toBe(true)
  })
})
