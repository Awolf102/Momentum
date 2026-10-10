import { describe, expect, it } from 'vitest'
import {
  createMemoryBackend,
  createPersistentStore,
  StoreRegistry,
} from '@/lib/persistentStore'
import { parseTimer } from '../store'
import type { TimerState } from '../types'
import {
  advance,
  cancel,
  durationsFrom,
  IDLE,
  pause,
  remainingMs,
  resume,
  scheduledEnd,
  sessionFor,
  sessionNumber,
  skipBreak,
  start,
} from './timer'

const MIN = 60_000
const durations = durationsFrom({
  focusMinutes: 25,
  shortBreakMinutes: 5,
  longBreakMinutes: 15,
})
const T0 = new Date(2026, 9, 10, 9, 0).getTime()

function focusing(at = T0, subjectId: string | null = 'calculus'): TimerState {
  return start(IDLE, { id: 'session-1', subjectId, now: at, durations })
}

describe('remaining time', () => {
  it('comes from timestamps, not ticks', () => {
    const state = focusing()
    expect(remainingMs(state.phase!, T0)).toBe(25 * MIN)
    expect(remainingMs(state.phase!, T0 + 10 * MIN)).toBe(15 * MIN)
    // However long the tab slept, the clock is the source of truth.
    expect(remainingMs(state.phase!, T0 + 24 * MIN + 59_000)).toBe(1000)
    expect(remainingMs(state.phase!, T0 + 3 * 60 * MIN)).toBe(0)
  })

  it('stands still while paused and carries on after resuming', () => {
    let state = focusing()
    state = pause(state, T0 + 10 * MIN)
    expect(remainingMs(state.phase!, T0 + 10 * MIN)).toBe(15 * MIN)
    expect(remainingMs(state.phase!, T0 + 50 * MIN)).toBe(15 * MIN)
    expect(scheduledEnd(state.phase!)).toBeNull()

    state = resume(state, T0 + 20 * MIN)
    expect(remainingMs(state.phase!, T0 + 20 * MIN)).toBe(15 * MIN)
    expect(remainingMs(state.phase!, T0 + 30 * MIN)).toBe(5 * MIN)
    expect(scheduledEnd(state.phase!)).toBe(T0 + 35 * MIN)

    // A second pause adds to the first.
    state = resume(pause(state, T0 + 30 * MIN), T0 + 33 * MIN)
    expect(state.phase!.pausedMs).toBe(13 * MIN)
    expect(scheduledEnd(state.phase!)).toBe(T0 + 38 * MIN)
  })

  it('ignores a double pause or resume', () => {
    const paused = pause(focusing(), T0 + MIN)
    expect(pause(paused, T0 + 2 * MIN)).toBe(paused)
    const running = focusing()
    expect(resume(running, T0 + MIN)).toBe(running)
  })

  it("won't pause or cancel a session whose time is already up", () => {
    const state = focusing()
    expect(pause(state, T0 + 26 * MIN)).toBe(state)
    expect(cancel(state, T0 + 26 * MIN)).toBe(state)
  })
})

describe('resuming after a reload', () => {
  it('picks up exactly where it was, running or paused', async () => {
    const backend = createMemoryBackend()
    const before = new StoreRegistry()
    const saved = createPersistentStore<TimerState>({
      key: 'timer',
      version: 1,
      defaultValue: IDLE,
      parse: parseTimer,
      registry: before,
    })
    await before.hydrate(backend)
    saved.set(pause(focusing(), T0 + 7 * MIN))
    await before.flush()

    // A fresh page load reads the same storage.
    const after = new StoreRegistry()
    const reloaded = createPersistentStore<TimerState>({
      key: 'timer',
      version: 1,
      defaultValue: IDLE,
      parse: parseTimer,
      registry: after,
    })
    await after.hydrate(backend)
    expect(reloaded.get()).toEqual(saved.get())
    expect(remainingMs(reloaded.get().phase!, T0 + 60 * MIN)).toBe(18 * MIN)

    const running = resume(reloaded.get(), T0 + 60 * MIN)
    expect(remainingMs(running.phase!, T0 + 61 * MIN)).toBe(17 * MIN)
  })
})

describe('advance', () => {
  it('ends a focus session at its scheduled time and starts the break then', () => {
    const { state, ended } = advance(focusing(), durations, T0 + 25 * MIN + 400)
    expect(ended).toEqual([{ phase: focusing().phase, endedAt: T0 + 25 * MIN }])
    expect(state.phase).toMatchObject({
      kind: 'short-break',
      startedAt: T0 + 25 * MIN,
      durationMs: 5 * MIN,
    })
    expect(state.completedInCycle).toBe(1)
  })

  it('does nothing before the end, or while paused', () => {
    const state = focusing()
    expect(advance(state, durations, T0 + 24 * MIN).ended).toEqual([])
    expect(
      advance(pause(state, T0 + MIN), durations, T0 + 5 * 60 * MIN).ended,
    ).toEqual([])
  })

  it('records a session that ended while the app was closed at its scheduled end', () => {
    // Started, paused 10 minutes, then the tab was closed for hours.
    let state = resume(pause(focusing(), T0 + 5 * MIN), T0 + 15 * MIN)
    const { state: after, ended } = advance(state, durations, T0 + 4 * 60 * MIN)
    expect(ended.map(({ phase, endedAt }) => [phase.kind, endedAt])).toEqual([
      ['focus', T0 + 35 * MIN],
      ['short-break', T0 + 40 * MIN],
    ])
    expect(after.phase).toBeNull()
    state = after
    const session = sessionFor(ended[0].phase, ended[0].endedAt)
    expect(session).toMatchObject({
      id: 'session-1',
      subjectId: 'calculus',
      startedAt: new Date(T0).toISOString(),
      endedAt: new Date(T0 + 35 * MIN).toISOString(),
      durationMs: 25 * MIN,
      pausedMs: 10 * MIN,
      day: '2026-10-10',
    })
  })

  it('reopening mid-break carries on with the break', () => {
    const { state } = advance(focusing(), durations, T0 + 27 * MIN)
    expect(state.phase?.kind).toBe('short-break')
    expect(remainingMs(state.phase!, T0 + 27 * MIN)).toBe(3 * MIN)
  })

  it('gives a long break after every fourth session, then starts over', () => {
    let state: TimerState = { ...IDLE, completedInCycle: 3 }
    state = start(state, { id: 's4', subjectId: null, now: T0, durations })
    expect(sessionNumber(state)).toBe(4)
    state = advance(state, durations, T0 + 25 * MIN).state
    expect(state.phase).toMatchObject({
      kind: 'long-break',
      durationMs: 15 * MIN,
    })
    state = advance(state, durations, T0 + 40 * MIN).state
    expect(state).toMatchObject({ phase: null, completedInCycle: 0 })
    expect(sessionNumber(state)).toBe(1)
  })

  it('counts a session that crosses midnight toward the day it started', () => {
    const lateNight = new Date(2026, 9, 10, 23, 50).getTime()
    const { ended } = advance(
      focusing(lateNight),
      durations,
      lateNight + 30 * MIN,
    )
    const session = sessionFor(ended[0].phase, ended[0].endedAt)
    expect(new Date(session.endedAt).getDate()).toBe(11)
    expect(session.day).toBe('2026-10-10')
  })
})

describe('controls', () => {
  it('cancels a focus session without counting it', () => {
    const state = cancel(focusing(), T0 + 5 * MIN)
    expect(state).toEqual(IDLE)
  })

  it('skips a break straight into the next session', () => {
    const onBreak = advance(focusing(), durations, T0 + 26 * MIN).state
    const next = skipBreak(onBreak, {
      id: 'session-2',
      subjectId: 'reading',
      now: T0 + 26 * MIN,
      durations,
    })
    expect(next.phase).toMatchObject({
      id: 'session-2',
      kind: 'focus',
      subjectId: 'reading',
      startedAt: T0 + 26 * MIN,
    })
    expect(next.completedInCycle).toBe(1)
    // Skip only applies to breaks.
    expect(
      skipBreak(focusing(), { id: 'x', subjectId: null, now: T0, durations }),
    ).toEqual(focusing())
  })

  it("won't start a second session over a running one", () => {
    const state = focusing()
    expect(
      start(state, { id: 'other', subjectId: null, now: T0 + MIN, durations }),
    ).toBe(state)
  })
})
