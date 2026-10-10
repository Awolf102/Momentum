import { afterEach, describe, expect, it } from 'vitest'
import { lineFor, logEntries, parseEntry, setLine } from './entries'

afterEach(() => logEntries.clear())

const at = (hour: number) => new Date(Date.UTC(2026, 9, 10, hour))

describe('the daily log', () => {
  it('keeps one line per day, updating it in place', async () => {
    await setLine('2026-10-10', 'Calculus problem set', at(1))
    await setLine('2026-10-10', 'Calculus problem set and the DFA lab', at(5))
    expect(lineFor('2026-10-10')).toBe('Calculus problem set and the DFA lab')
    const [entry] = logEntries.get()
    expect(logEntries.get()).toHaveLength(1)
    expect(entry.id).toBe('2026-10-10')
    // When it was first written is kept; the edit time moves on.
    expect(entry.createdAt).toBe(at(1).toISOString())
    expect(entry.updatedAt).toBe(at(5).toISOString())
  })

  it('deletes a line saved empty, keeping a record of the deletion', async () => {
    await setLine('2026-10-10', 'Lab', at(1))
    await setLine('2026-10-10', '   ', at(2))
    expect(lineFor('2026-10-10')).toBe('')
    expect(logEntries.get()).toHaveLength(0)
    expect(logEntries.find('2026-10-10')?.deletedAt).toBe(at(2).toISOString())
    // And it can be written again.
    await setLine('2026-10-10', 'Lab, after all', at(3))
    expect(lineFor('2026-10-10')).toBe('Lab, after all')
  })

  it("doesn't save when nothing changed", async () => {
    await setLine('2026-10-10', 'Lab', at(1))
    await setLine('2026-10-10', '  Lab ', at(2))
    expect(logEntries.find('2026-10-10')?.updatedAt).toBe(at(1).toISOString())
  })

  it('only reads records whose id is their day', () => {
    const base = { text: 'x', updatedAt: at(1).toISOString() }
    expect(
      parseEntry({ ...base, id: '2026-10-10', day: '2026-10-10' }),
    ).not.toBeNull()
    expect(parseEntry({ ...base, id: 'other', day: '2026-10-10' })).toBeNull()
    expect(
      parseEntry({ ...base, id: '2026-13-40', day: '2026-13-40' }),
    ).toBeNull()
  })
})
