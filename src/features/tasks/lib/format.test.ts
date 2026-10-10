import { describe, expect, it } from 'vitest'
import { dueInSentence, formatDue } from './format'

// Saturday 10 October 2026.
const today = '2026-10-10'

describe('due dates in words', () => {
  it('says relative days, then weekdays, then dates', () => {
    expect(formatDue('2026-10-10', today)).toBe('Today')
    expect(formatDue('2026-10-11', today)).toBe('Tomorrow')
    expect(formatDue('2026-10-09', today)).toBe('Yesterday')
    expect(formatDue('2026-10-15', today)).toBe('Thursday')
    expect(formatDue('2026-10-20', today)).toMatch(/20 Oct|Oct 20/)
    expect(formatDue('2027-01-05', today)).toMatch(/2027/)
  })

  it('keeps day names capitalised inside a sentence', () => {
    expect(dueInSentence('2026-10-11', today)).toBe('tomorrow')
    expect(dueInSentence('2026-10-15', today)).toBe('Thursday')
  })
})
