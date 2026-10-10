import { describe, expect, it } from 'vitest'
import type { FocusSession } from '../types'
import { focusLevel, focusLevels, formatMinutes, totalsByDay } from './stats'

const MIN = 60_000
let next = 0
function session(
  day: string,
  minutes: number,
  subjectId: string | null = 'calculus',
  extra: Partial<FocusSession> = {},
): FocusSession {
  next++
  return {
    id: `s${next}`,
    subjectId,
    startedAt: `${day}T09:00:00.000Z`,
    endedAt: `${day}T09:25:00.000Z`,
    durationMs: minutes * MIN,
    pausedMs: 0,
    day,
    createdAt: `${day}T09:25:00.000Z`,
    updatedAt: `${day}T09:25:00.000Z`,
    ...extra,
  }
}

describe('daily totals', () => {
  it('adds up minutes and sessions per day and per subject', () => {
    const totals = totalsByDay([
      session('2026-10-10', 25),
      session('2026-10-10', 25, 'reading'),
      session('2026-10-10', 50),
      session('2026-10-09', 25, null),
    ])
    const today = totals.get('2026-10-10')!
    expect(today.minutes).toBe(100)
    expect(today.sessions).toBe(3)
    expect(Object.fromEntries(today.bySubject)).toEqual({
      calculus: 75,
      reading: 25,
    })
    expect(totals.get('2026-10-09')).toMatchObject({ minutes: 25, sessions: 1 })
    expect(Object.fromEntries(totals.get('2026-10-09')!.bySubject)).toEqual({
      '': 25,
    })
  })

  it('leaves out deleted sessions', () => {
    const totals = totalsByDay([
      session('2026-10-10', 25, 'calculus', {
        deletedAt: '2026-10-10T10:00:00.000Z',
      }),
    ])
    expect(totals.has('2026-10-10')).toBe(false)
  })

  it('rounds to whole minutes only after adding up', () => {
    const totals = totalsByDay([
      { ...session('2026-10-10', 0), durationMs: 30_000 },
      { ...session('2026-10-10', 0), durationMs: 30_000 },
    ])
    expect(totals.get('2026-10-10')!.minutes).toBe(1)
  })
})

describe('calendar levels', () => {
  it('shades by minutes: one session, two, four, six', () => {
    expect([0, 25, 50, 75, 100, 149, 150, 400].map(focusLevel)).toEqual([
      0, 1, 2, 2, 3, 3, 4, 4,
    ])
    const levels = focusLevels(
      totalsByDay([session('2026-10-10', 100), session('2026-10-08', 25)]),
    )
    expect(Object.fromEntries(levels)).toEqual({
      '2026-10-10': 3,
      '2026-10-08': 1,
    })
  })

  it('formats minutes for people', () => {
    expect(formatMinutes(45)).toBe('45 min')
    expect(formatMinutes(60)).toBe('1 h')
    expect(formatMinutes(75)).toBe('1 h 15 min')
  })
})
