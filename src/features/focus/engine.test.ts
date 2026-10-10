import { describe, expect, it } from 'vitest'
import type { DateKey } from '@/lib/date'
import { createStore } from '@/lib/store'
import { settle, type EngineDeps } from './engine'
import { durationsFrom, IDLE, start } from './lib/timer'
import type { FocusSession, TimerState } from './types'

const MIN = 60_000
const durations = durationsFrom({
  focusMinutes: 25,
  shortBreakMinutes: 5,
  longBreakMinutes: 15,
})
const at = (day: number, hour: number, minute = 0) =>
  new Date(2026, 9, day, hour, minute).getTime()

function setup(
  options: { checkedIn?: DateKey[]; savedElsewhere?: string[] } = {},
) {
  const timer = createStore<TimerState>(IDLE)
  const saved = new Map<string, FocusSession>()
  for (const id of options.savedElsewhere ?? [])
    saved.set(id, {} as FocusSession)
  const checkedIn = new Set(options.checkedIn)
  const checkIns: Array<{ at: number; day: DateKey }> = []
  const deps: EngineDeps = {
    timer,
    durations: () => durations,
    async record(session) {
      if (saved.has(session.id)) return false
      saved.set(session.id, session)
      return true
    },
    checkIn(when, day) {
      checkIns.push({ at: when.getTime(), day })
      if (checkedIn.has(day)) return false
      checkedIn.add(day)
      return true
    },
  }
  const begin = (id: string, now: number) =>
    timer.set((state) =>
      start(state, { id, subjectId: 'calculus', now, durations }),
    )
  return { deps, timer, saved, checkIns, begin }
}

describe('settle', () => {
  it('saves a finished session and checks the day in', async () => {
    const { deps, saved, checkIns, begin } = setup()
    begin('s1', at(10, 9))
    const completions = await settle(deps, at(10, 9, 25))
    expect(completions).toHaveLength(1)
    expect(completions[0]).toMatchObject({ recorded: true, checkedIn: true })
    expect(saved.get('s1')).toMatchObject({
      day: '2026-10-10',
      durationMs: 25 * MIN,
    })
    expect(checkIns).toEqual([{ at: at(10, 9, 25), day: '2026-10-10' }])
  })

  it('auto check-in fires only once per day', async () => {
    const { deps, timer, checkIns, begin } = setup()
    begin('s1', at(10, 9))
    await settle(deps, at(10, 9, 40)) // session done, break done
    begin('s2', at(10, 10))
    const second = await settle(deps, at(10, 10, 25))
    expect(second[0].checkedIn).toBe(false)
    expect(checkIns.map((c) => c.day)).toEqual(['2026-10-10'])
    // The next day is a new day.
    timer.set((state) => ({ ...state, phase: null }))
    begin('s3', at(11, 9))
    await settle(deps, at(11, 9, 30))
    expect(checkIns.map((c) => c.day)).toEqual(['2026-10-10', '2026-10-11'])
  })

  it("doesn't re-check in after a manual check-in that day", async () => {
    const { deps, checkIns, begin } = setup({ checkedIn: ['2026-10-10'] })
    begin('s1', at(10, 9))
    const [first] = await settle(deps, at(10, 9, 25))
    expect(first.checkedIn).toBe(false)
    begin('s2', at(10, 10))
    await settle(deps, at(10, 10, 40))
    // Considered once (the first session), never again that day.
    expect(checkIns).toHaveLength(1)
  })

  it('catches up on a session that ended while the app was closed', async () => {
    const { deps, timer, saved, begin } = setup()
    begin('s1', at(10, 9))
    const completions = await settle(deps, at(10, 14))
    expect(completions.map((c) => c.phase.kind)).toEqual([
      'focus',
      'short-break',
    ])
    expect(saved.get('s1')?.endedAt).toBe(new Date(at(10, 9, 25)).toISOString())
    expect(timer.get().phase).toBeNull()
  })

  it('checks in the day a late session started, not the day it ended', async () => {
    const { deps, checkIns, begin } = setup()
    begin('late', at(10, 23, 50))
    await settle(deps, at(11, 0, 20))
    expect(checkIns).toEqual([{ at: at(11, 0, 15), day: '2026-10-10' }])
  })

  it('leaves the announcement to the tab that saved the session', async () => {
    const { deps, checkIns, begin } = setup({ savedElsewhere: ['s1'] })
    begin('s1', at(10, 9))
    const [completion] = await settle(deps, at(10, 9, 25))
    expect(completion).toMatchObject({ recorded: false, checkedIn: false })
    expect(checkIns).toEqual([])
  })

  it('does the work once when two wake-ups arrive together', async () => {
    const { deps, saved, begin } = setup()
    begin('s1', at(10, 9))
    const [a, b] = await Promise.all([
      settle(deps, at(10, 9, 26)),
      settle(deps, at(10, 9, 26)),
    ])
    expect(a.length + b.length).toBe(1)
    expect(saved.size).toBe(1)
  })
})
