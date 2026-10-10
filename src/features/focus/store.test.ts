import { describe, expect, it } from 'vitest'
import { IDLE } from './lib/timer'
import { focusTimerStore, parseFocusSettings, parseTimer } from './store'
import type { ActivePhase } from './types'

const phase = (id: string): ActivePhase => ({
  id,
  kind: 'focus',
  subjectId: 'calculus',
  startedAt: Date.UTC(2026, 9, 10, 8),
  durationMs: 25 * 60_000,
  pausedAt: null,
  pausedMs: 0,
})

describe('focus settings', () => {
  it('keeps lengths within limits and fills gaps with defaults', () => {
    expect(
      parseFocusSettings({ focusMinutes: 0, shortBreakMinutes: 600 }),
    ).toMatchObject({
      focusMinutes: 1,
      shortBreakMinutes: 60,
      longBreakMinutes: 15,
      autoAmbience: false,
    })
  })
})

describe('the saved timer', () => {
  it('rejects a phase that is missing its timestamps', () => {
    const { startedAt: _, ...broken } = phase('a')
    expect(parseTimer({ ...IDLE, phase: broken })?.phase).toBeNull()
    expect(parseTimer({ ...IDLE, phase: phase('a') })?.phase?.id).toBe('a')
  })

  it("isn't replaced by an old timer from a backup", () => {
    focusTimerStore.set({ ...IDLE, phase: phase('running-here') })
    focusTimerStore.restore({ ...IDLE, phase: phase('from-backup') })
    expect(focusTimerStore.get().phase?.id).toBe('running-here')
    focusTimerStore.reset()
  })
})
