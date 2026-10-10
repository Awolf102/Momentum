import { describe, expect, it } from 'vitest'
import { buildTimeline, groupByMonth, type DayFocus } from './timeline'

const focus = (minutes: number): DayFocus => ({
  minutes,
  sessions: Math.round(minutes / 25),
  subjects: [],
})

describe('the log timeline', () => {
  const timeline = buildTimeline({
    lines: new Map([
      ['2026-10-08', 'Finished the DFA lab'],
      ['2026-09-30', 'Read chapter 4'],
      ['2026-10-12', 'From a device whose clock is ahead'],
    ]),
    checkIns: ['2026-10-09', '2026-10-08'],
    focus: new Map([
      ['2026-10-07', focus(50)],
      ['2026-10-06', focus(0)],
    ]),
    today: '2026-10-10',
  })

  it('has every day with a line, a check-in or focus, newest first', () => {
    expect(timeline.map((day) => day.day)).toEqual([
      '2026-10-10',
      '2026-10-09',
      '2026-10-08',
      '2026-10-07',
      '2026-09-30',
    ])
  })

  it('always starts with today, even an empty one', () => {
    expect(timeline[0]).toEqual({
      day: '2026-10-10',
      line: '',
      checkedIn: false,
      focus: null,
    })
  })

  it('puts what happened on each day together', () => {
    expect(timeline[2]).toEqual({
      day: '2026-10-08',
      line: 'Finished the DFA lab',
      checkedIn: true,
      focus: null,
    })
    expect(timeline[3].focus?.minutes).toBe(50)
  })

  it('groups days into months', () => {
    expect(
      groupByMonth(timeline).map(({ month, days }) => [month, days.length]),
    ).toEqual([
      ['2026-10', 4],
      ['2026-09', 1],
    ])
  })
})
