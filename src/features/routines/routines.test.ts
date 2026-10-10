import { afterEach, describe, expect, it } from 'vitest'
import { partOfDay, progress, sortForNow } from './lib/day'
import { routineRuns, runId, toggleStep } from './runs'
import {
  addRoutine,
  addStep,
  liveRoutines,
  moveStep,
  removeStep,
  routinesStore,
} from './store'

afterEach(async () => {
  routinesStore.reset()
  await routineRuns.clear()
})

const at = (minutes: number) => new Date(Date.UTC(2026, 9, 9, 21, minutes))
const day = '2026-10-10'

describe('routines', () => {
  it('knows the part of the day', () => {
    expect(partOfDay(4)).toBe('morning')
    expect(partOfDay(11)).toBe('morning')
    expect(partOfDay(12)).toBe('afternoon')
    expect(partOfDay(17)).toBe('evening')
    expect(partOfDay(2)).toBe('evening')
  })

  it('puts the one for now first, then any time, then the rest', () => {
    addRoutine({ name: 'Morning', part: 'morning' }, at(0))
    addRoutine({ name: 'Study', part: 'anytime' }, at(1))
    addRoutine({ name: 'Evening', part: 'evening' }, at(2))
    const routines = liveRoutines(routinesStore.get())
    expect(sortForNow(routines, 'evening').map((r) => r.name)).toEqual([
      'Evening',
      'Study',
      'Morning',
    ])
    expect(sortForNow(routines, 'morning').map((r) => r.name)).toEqual([
      'Morning',
      'Study',
      'Evening',
    ])
  })

  it('edits steps: add, reorder, remove', () => {
    const routine = addRoutine(
      { name: 'Evening', part: 'evening', steps: ['Log', 'Tidy', ' '] },
      at(0),
    )!
    expect(routine.steps.map((s) => s.text)).toEqual(['Log', 'Tidy'])
    addStep(routine.id, 'Read', at(1))
    const [log, tidy] = liveRoutines(routinesStore.get())[0].steps
    moveStep(routine.id, tidy.id, -1, at(2))
    removeStep(routine.id, log.id, at(3))
    expect(
      liveRoutines(routinesStore.get())[0].steps.map((s) => s.text),
    ).toEqual(['Tidy', 'Read'])
  })

  it('completes a day when every step is ticked, and reopens it', async () => {
    const routine = addRoutine(
      { name: 'Morning', part: 'morning', steps: ['Water', 'Stretch'] },
      at(0),
    )!
    const [water, stretch] = routine.steps
    await toggleStep(routine.id, water.id, day, at(1))
    let run = routineRuns.find(runId(routine.id, day))
    expect(progress(routine, run)).toEqual({
      done: 1,
      total: 2,
      complete: false,
    })
    await toggleStep(routine.id, stretch.id, day, at(2))
    run = routineRuns.find(runId(routine.id, day))
    expect(run?.completedAt).toBe(at(2).toISOString())
    expect(progress(routine, run).complete).toBe(true)
    await toggleStep(routine.id, water.id, day, at(3))
    run = routineRuns.find(runId(routine.id, day))
    expect(run?.completedAt).toBeNull()
  })

  it("doesn't count steps that were removed since", async () => {
    const routine = addRoutine(
      { name: 'Morning', part: 'morning', steps: ['Water', 'Stretch'] },
      at(0),
    )!
    await toggleStep(routine.id, routine.steps[0].id, day, at(1))
    removeStep(routine.id, routine.steps[0].id, at(2))
    const current = liveRoutines(routinesStore.get())[0]
    expect(progress(current, routineRuns.find(runId(routine.id, day)))).toEqual(
      {
        done: 0,
        total: 1,
        complete: false,
      },
    )
  })
})
