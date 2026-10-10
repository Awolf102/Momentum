import { afterEach, describe, expect, it } from 'vitest'
import { boardColumns } from './lib/board'
import { groupTasks } from './lib/groups'
import {
  addTask,
  completeTask,
  deleteTask,
  moveTask,
  reopenTask,
  tasks,
  updateTask,
  type NewTask,
} from './tasks'

afterEach(() => tasks.clear())

// Saturday 10 October 2026, 9am in Sydney.
const now = new Date('2026-10-09T22:00:00.000Z')
const later = (minutes: number) => new Date(now.getTime() + minutes * 60_000)

const input = (title: string, extra: Partial<NewTask> = {}): NewTask => ({
  title,
  due: null,
  time: null,
  subjectId: null,
  priority: 0,
  recurrence: null,
  ...extra,
})

describe('tasks', () => {
  it('adds tasks to the end of To do', async () => {
    const a = await addTask(input('First'), now)
    const b = await addTask(input('Second'), later(1))
    expect(a?.order).toBe(0)
    expect(b?.order).toBe(1)
    expect(boardColumns(tasks.get()).todo.map((t) => t.title)).toEqual([
      'First',
      'Second',
    ])
    expect(await addTask(input('   '), now)).toBeNull()
  })

  it('finishes and reopens a task', async () => {
    const task = (await addTask(input('Lab report'), now))!
    expect(await completeTask(task.id, later(5))).toBeNull()
    expect(tasks.find(task.id)).toMatchObject({
      status: 'done',
      completedAt: later(5).toISOString(),
    })
    await reopenTask(task.id, later(6))
    expect(tasks.find(task.id)).toMatchObject({
      status: 'todo',
      completedAt: null,
    })
  })

  it('makes the next occurrence when a repeating task is done', async () => {
    const task = (await addTask(
      input('Water plants', {
        due: '2026-10-09',
        recurrence: {
          unit: 'day',
          interval: 1,
          weekdays: [],
          anchor: '2026-10-01',
        },
        subjectId: 'reading',
        priority: 2,
      }),
      now,
    ))!
    const next = await completeTask(task.id, now)
    // A day late: next due tomorrow, not today.
    expect(next).toMatchObject({
      id: `${task.id}@2026-10-11`,
      seriesId: task.id,
      title: 'Water plants',
      due: '2026-10-11',
      status: 'todo',
      subjectId: 'reading',
      priority: 2,
    })
    // Finishing the same occurrence again (another tab) changes nothing.
    expect(await completeTask(task.id, later(1))).toBeNull()
    expect(tasks.get().filter((t) => t.status === 'todo')).toHaveLength(1)
  })

  it('keeps time and repeat only with a due date, and moves the schedule with it', async () => {
    const task = (await addTask(
      input('Gym', {
        due: '2026-10-12',
        time: '07:00',
        recurrence: {
          unit: 'week',
          interval: 1,
          weekdays: [1],
          anchor: '2026-10-12',
        },
      }),
      now,
    ))!
    await updateTask(task.id, { due: '2026-10-13' }, later(1))
    expect(tasks.find(task.id)?.recurrence?.anchor).toBe('2026-10-13')
    await updateTask(task.id, { due: null }, later(2))
    expect(tasks.find(task.id)).toMatchObject({ time: null, recurrence: null })
  })

  it('moves cards on the board, finishing and reopening across Done', async () => {
    const a = (await addTask(input('A'), now))!
    const b = (await addTask(input('B'), now))!
    const c = (await addTask(input('C'), now))!
    await moveTask(c.id, 'todo', a.id, later(1))
    expect(boardColumns(tasks.get()).todo.map((t) => t.title)).toEqual([
      'C',
      'A',
      'B',
    ])
    await moveTask(a.id, 'doing', null, later(2))
    await moveTask(b.id, 'done', null, later(3))
    const columns = boardColumns(tasks.get())
    expect(columns.doing.map((t) => t.title)).toEqual(['A'])
    expect(columns.done[0]).toMatchObject({
      title: 'B',
      completedAt: later(3).toISOString(),
    })
    await moveTask(b.id, 'doing', a.id, later(4))
    expect(boardColumns(tasks.get()).doing.map((t) => t.title)).toEqual([
      'B',
      'A',
    ])
    expect(tasks.find(b.id)?.completedAt).toBeNull()
  })

  it('deletes softly', async () => {
    const task = (await addTask(input('Old'), now))!
    await deleteTask(task.id, later(1))
    expect(tasks.get()).toHaveLength(0)
    expect(tasks.find(task.id)?.deletedAt).toBe(later(1).toISOString())
  })
})

describe('the list view', () => {
  it('groups by when things are due, soonest and most important first', async () => {
    await addTask(input('Someday'), now)
    await addTask(input('Late', { due: '2026-10-08' }), now)
    await addTask(input('Today, low', { due: '2026-10-10', priority: 1 }), now)
    await addTask(input('Today, high', { due: '2026-10-10', priority: 3 }), now)
    await addTask(input('Today 9am', { due: '2026-10-10', time: '09:00' }), now)
    await addTask(input('Tomorrow', { due: '2026-10-11' }), now)
    await addTask(input('Next week', { due: '2026-10-19' }), now)
    const done = (await addTask(input('Finished'), now))!
    await completeTask(done.id, now)
    const groups = groupTasks(tasks.get(), '2026-10-10')
    expect(groups.map((g) => [g.label, g.tasks.map((t) => t.title)])).toEqual([
      ['Overdue', ['Late']],
      ['Today', ['Today 9am', 'Today, high', 'Today, low']],
      ['Tomorrow', ['Tomorrow']],
      ['Later', ['Next week']],
      ['No date', ['Someday']],
      ['Done', ['Finished']],
    ])
  })
})
