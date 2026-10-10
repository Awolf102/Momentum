import { describe, expect, it } from 'vitest'
import { buildCalendar } from './buildCalendar'

describe('buildCalendar', () => {
  const columns = buildCalendar({
    today: '2026-10-10',
    weeks: 12,
    weekStartsOn: 1,
    locale: 'en-US',
  })

  it('ends with the week containing today', () => {
    expect(columns).toHaveLength(12)
    const last = columns[columns.length - 1]
    expect(last.cells[0].date).toBe('2026-10-05') // Monday
    expect(last.cells.find((cell) => cell.isToday)?.date).toBe('2026-10-10')
  })

  it('marks days after today as future', () => {
    const last = columns[columns.length - 1]
    expect(
      last.cells.filter((cell) => cell.isFuture).map((cell) => cell.date),
    ).toEqual(['2026-10-11'])
  })

  it('is a contiguous run of weeks', () => {
    const dates = columns.flatMap((column) =>
      column.cells.map((cell) => cell.date),
    )
    expect(new Set(dates).size).toBe(12 * 7)
    expect(dates[0]).toBe('2026-07-20')
  })

  it('labels the week that contains the 1st of each month', () => {
    const labels = columns
      .map((column, index) => [index, column.monthLabel] as const)
      .filter(([, label]) => label !== null)
    expect(labels).toEqual([
      [1, 'Aug'],
      [6, 'Sep'],
      [10, 'Oct'],
    ])
  })

  it('labels the first column when there is room', () => {
    const wide = buildCalendar({
      today: '2026-10-10',
      weeks: 14, // starts Mon Jul 6; the next label (Aug) is 3 columns away
      weekStartsOn: 1,
      locale: 'en-US',
    })
    expect(wide[0].monthLabel).toBe('Jul')
  })
})
