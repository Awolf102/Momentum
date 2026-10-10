import { afterEach, describe, expect, it } from 'vitest'
import { habitCheckIns, isDone, toggleHabit } from './checkIns'
import {
  addHabit,
  habitsStore,
  liveHabits,
  mergeHabits,
  removeHabit,
  updateHabit,
} from './store'

afterEach(async () => {
  habitsStore.reset()
  await habitCheckIns.clear()
})

const at = (minutes: number) => new Date(Date.UTC(2026, 9, 9, 22, minutes))

describe('habits', () => {
  it('adds habits in order, each in its own colour, once per name', () => {
    const read = addHabit('Read 20 pages', [], at(0))!
    const gym = addHabit('Gym', [1, 3, 5], at(1))!
    expect(addHabit('  read 20 PAGES ', [], at(2))?.id).toBe(read.id)
    expect(liveHabits(habitsStore.get()).map((h) => h.name)).toEqual([
      'Read 20 pages',
      'Gym',
    ])
    expect(read.color).not.toBe(gym.color)
    expect(addHabit('   ')).toBeNull()
  })

  it('edits and removes', () => {
    const habit = addHabit('Stretch', [], at(0))!
    updateHabit(habit.id, { name: 'Stretch 10 min', weekdays: [1, 2] }, at(1))
    expect(liveHabits(habitsStore.get())[0]).toMatchObject({
      name: 'Stretch 10 min',
      weekdays: [1, 2],
      updatedAt: at(1).toISOString(),
    })
    removeHabit(habit.id, at(2))
    expect(liveHabits(habitsStore.get())).toEqual([])
  })

  it('marks a day done and undone, keeping the undo', async () => {
    const habit = addHabit('Read', [], at(0))!
    expect(await toggleHabit(habit.id, '2026-10-10', at(1))).toBe(true)
    expect(isDone(habit.id, '2026-10-10')).toBe(true)
    expect(await toggleHabit(habit.id, '2026-10-10', at(2))).toBe(false)
    expect(isDone(habit.id, '2026-10-10')).toBe(false)
    expect(habitCheckIns.find(`${habit.id}:2026-10-10`)?.deletedAt).toBe(
      at(2).toISOString(),
    )
    expect(await toggleHabit(habit.id, '2026-10-10', at(3))).toBe(true)
  })

  it('merges a backup: both sides kept, the later edit wins', () => {
    const base = {
      color: 'amber' as const,
      weekdays: [],
      order: 0,
      createdAt: at(0).toISOString(),
      deletedAt: null,
    }
    const merged = mergeHabits(
      {
        habits: [
          { ...base, id: 'a', name: 'Read', updatedAt: at(5).toISOString() },
        ],
      },
      {
        habits: [
          {
            ...base,
            id: 'a',
            name: 'Read (old)',
            updatedAt: at(1).toISOString(),
          },
          { ...base, id: 'b', name: 'Gym', updatedAt: at(1).toISOString() },
        ],
      },
    )
    expect(merged.habits.map((h) => h.name)).toEqual(['Read', 'Gym'])
  })
})
