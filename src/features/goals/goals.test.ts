import { afterEach, describe, expect, it } from 'vitest'
import {
  addTask,
  completeTask,
  deleteTask,
  tasks,
  type NewTask,
} from '@/features/tasks'
import {
  achieveGoal,
  addGoal,
  addMilestone,
  addTaskToGoal,
  archiveGoal,
  deleteGoal,
  linkHabit,
  linkTask,
  moveGoal,
  moveMilestone,
  removeMilestone,
  reopenGoal,
  restoreGoal,
  restoreMilestone,
  toggleMilestone,
  unlinkHabit,
  unlinkTask,
  updateGoal,
  updateMilestone,
} from './actions'
import { goals, MAX_MILESTONES, parseGoal, sortGoals } from './goals'
import { goalProgress, linkedTasks } from './lib/progress'
import type { Goal } from './types'

afterEach(async () => {
  await goals.clear()
  await tasks.clear()
})

// Saturday 10 October 2026, 9am in Sydney.
const now = new Date('2026-10-09T22:00:00.000Z')
const later = (days: number) => new Date(now.getTime() + days * 86_400_000)
const TODAY = '2026-10-10'

const input = (title: string, extra: Partial<NewTask> = {}): NewTask => ({
  title,
  due: null,
  time: null,
  subjectId: null,
  priority: 0,
  recurrence: null,
  ...extra,
})

const stored = (extra: Record<string, unknown> = {}) => ({
  id: 'g1',
  title: 'Pass calculus',
  createdAt: now.toISOString(),
  updatedAt: now.toISOString(),
  ...extra,
})

describe('reading goals back', () => {
  it('fills in what an older or partial record leaves out', () => {
    expect(parseGoal(stored())).toEqual({
      id: 'g1',
      title: 'Pass calculus',
      why: '',
      subjectId: null,
      target: null,
      milestones: [],
      taskIds: [],
      habitIds: [],
      status: 'active',
      closedAt: null,
      order: 0,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      deletedAt: null,
    })
  })

  it('turns away records it cannot use', () => {
    expect(parseGoal(null)).toBeNull()
    expect(parseGoal([])).toBeNull()
    expect(parseGoal(stored({ title: '   ' }))).toBeNull()
    expect(parseGoal(stored({ id: 4 }))).toBeNull()
    expect(parseGoal(stored({ updatedAt: undefined }))).toBeNull()
  })

  it('keeps milestones and links tidy', () => {
    const goal = parseGoal(
      stored({
        target: '2026-02-30',
        status: 'finished',
        closedAt: now.toISOString(),
        milestones: [
          { id: 'm1', title: ' Chapter 1 ', due: '2026-11-01', doneAt: null },
          { id: 'm1', title: 'Twice', due: null, doneAt: null },
          { id: 'm2', title: '', due: null, doneAt: null },
          { id: 'm3', title: 'Midterm', due: 'soon', doneAt: 7 },
          'not a milestone',
        ],
        taskIds: ['t1', 't1', 4, 't2'],
        habitIds: 'h1',
      }),
    )!
    expect(goal.target).toBeNull()
    expect(goal.status).toBe('active')
    // Only a closed goal has a closing time.
    expect(goal.closedAt).toBeNull()
    expect(goal.milestones).toEqual([
      { id: 'm1', title: 'Chapter 1', due: '2026-11-01', doneAt: null },
      { id: 'm3', title: 'Midterm', due: null, doneAt: null },
    ])
    expect(goal.taskIds).toEqual(['t1', 't2'])
    expect(goal.habitIds).toEqual([])
  })
})

describe('goals', () => {
  it('adds goals at the end, with their first milestones', async () => {
    const a = await addGoal(
      {
        title: '  Pass calculus  ',
        why: 'For the engineering major',
        target: '2026-12-01',
        milestones: ['Chapter 1', ' ', 'Midterm'],
      },
      now,
    )
    const b = await addGoal({ title: 'Run 10 km' }, later(1))
    expect(await addGoal({ title: '  ' }, now)).toBeNull()
    expect(a).toMatchObject({
      title: 'Pass calculus',
      why: 'For the engineering major',
      target: '2026-12-01',
      status: 'active',
      order: 0,
    })
    expect(a!.milestones.map((each) => each.title)).toEqual([
      'Chapter 1',
      'Midterm',
    ])
    expect(b!.order).toBe(1)
    expect(goals.get()).toHaveLength(2)
  })

  it('edits a goal, keeping its title if the new one is empty', async () => {
    const goal = (await addGoal({ title: 'Pass calculus' }, now))!
    await updateGoal(
      goal.id,
      { title: ' ', why: ' Because ', target: '2027-01-01' },
      later(1),
    )
    expect(goals.find(goal.id)).toMatchObject({
      title: 'Pass calculus',
      why: 'Because',
      target: '2027-01-01',
      updatedAt: later(1).toISOString(),
    })
  })

  it('reaches, puts away and reopens goals', async () => {
    const a = (await addGoal({ title: 'A' }, now))!
    const b = (await addGoal({ title: 'B' }, now))!
    const c = (await addGoal({ title: 'C' }, now))!
    await achieveGoal(a.id, later(1))
    await archiveGoal(b.id, later(2))
    expect(goals.find(a.id)).toMatchObject({
      status: 'achieved',
      closedAt: later(1).toISOString(),
    })
    expect(sortGoals(goals.get()).map((goal) => goal.title)).toEqual([
      'C',
      'B',
      'A',
    ])
    await reopenGoal(a.id, later(3))
    // Back at the end of the active goals.
    expect(goals.find(a.id)).toMatchObject({ status: 'active', closedAt: null })
    expect(goals.find(a.id)!.order).toBeGreaterThan(c.order)
    expect(sortGoals(goals.get()).map((goal) => goal.title)).toEqual([
      'C',
      'A',
      'B',
    ])
  })

  it('moves active goals up and down', async () => {
    for (const title of ['A', 'B', 'C']) await addGoal({ title }, now)
    const [, b] = sortGoals(goals.get())
    await moveGoal(b.id, -1, later(1))
    expect(sortGoals(goals.get()).map((goal) => goal.title)).toEqual([
      'B',
      'A',
      'C',
    ])
    await moveGoal(b.id, -1, later(2))
    expect(sortGoals(goals.get()).map((goal) => goal.title)).toEqual([
      'B',
      'A',
      'C',
    ])
    await moveGoal(b.id, 1, later(3))
    await moveGoal(b.id, 1, later(4))
    expect(sortGoals(goals.get()).map((goal) => goal.title)).toEqual([
      'A',
      'C',
      'B',
    ])
  })

  it('deletes a goal, and Undo brings it back', async () => {
    const goal = (await addGoal({ title: 'Pass calculus' }, now))!
    await deleteGoal(goal.id, later(1))
    expect(goals.get()).toEqual([])
    await restoreGoal(goal.id, later(2))
    expect(goals.get().map((each) => each.title)).toEqual(['Pass calculus'])
  })
})

describe('milestones', () => {
  it('adds, edits, ticks off and reorders them', async () => {
    const goal = (await addGoal({ title: 'Pass calculus' }, now))!
    const first = (await addMilestone(goal.id, ' Chapter 1 ', null, now))!
    const second = (await addMilestone(goal.id, 'Midterm', '2026-11-05', now))!
    expect(await addMilestone(goal.id, '  ', null, now)).toBeNull()
    expect(goals.find(goal.id)!.milestones.map((each) => each.title)).toEqual([
      'Chapter 1',
      'Midterm',
    ])

    await updateMilestone(
      goal.id,
      first.id,
      { title: 'Chapters 1–2', due: '2026-10-20' },
      now,
    )
    expect(await toggleMilestone(goal.id, first.id, later(1))).toBe(true)
    expect(goals.find(goal.id)!.milestones[0]).toEqual({
      id: first.id,
      title: 'Chapters 1–2',
      due: '2026-10-20',
      doneAt: later(1).toISOString(),
    })
    expect(await toggleMilestone(goal.id, first.id, later(2))).toBe(false)
    expect(goals.find(goal.id)!.milestones[0].doneAt).toBeNull()

    await moveMilestone(goal.id, second.id, -1, now)
    expect(goals.find(goal.id)!.milestones.map((each) => each.id)).toEqual([
      second.id,
      first.id,
    ])
    // Already at the top: nothing changes.
    await moveMilestone(goal.id, second.id, -1, later(3))
    expect(goals.find(goal.id)!.updatedAt).toBe(now.toISOString())
  })

  it('takes one off, and Undo puts it back where it was', async () => {
    const goal = (await addGoal(
      { title: 'G', milestones: ['A', 'B', 'C'] },
      now,
    ))!
    const b = goal.milestones[1]
    const removed = (await removeMilestone(goal.id, b.id, later(1)))!
    expect(removed.index).toBe(1)
    expect(goals.find(goal.id)!.milestones.map((each) => each.title)).toEqual([
      'A',
      'C',
    ])
    await restoreMilestone(goal.id, removed.milestone, removed.index, later(2))
    expect(goals.find(goal.id)!.milestones.map((each) => each.title)).toEqual([
      'A',
      'B',
      'C',
    ])
    // Restoring twice doesn't add it twice.
    await restoreMilestone(goal.id, removed.milestone, removed.index, later(3))
    expect(goals.find(goal.id)!.milestones).toHaveLength(3)
  })

  it('stops at the most a goal can have', async () => {
    const goal = (await addGoal(
      {
        title: 'G',
        milestones: Array.from(
          { length: MAX_MILESTONES },
          (_, i) => `Step ${i + 1}`,
        ),
      },
      now,
    ))!
    expect(goal.milestones).toHaveLength(MAX_MILESTONES)
    expect(await addMilestone(goal.id, 'One more', null, now)).toBeNull()
  })
})

describe('linked tasks and habits', () => {
  it('links tasks once each, and unlinks them', async () => {
    const goal = (await addGoal({ title: 'G' }, now))!
    const task = (await addTask(input('Revise limits'), now))!
    await linkTask(goal.id, task.seriesId, now)
    await linkTask(goal.id, task.seriesId, later(1))
    expect(goals.find(goal.id)!.taskIds).toEqual([task.seriesId])
    await unlinkTask(goal.id, task.seriesId, later(2))
    expect(goals.find(goal.id)!.taskIds).toEqual([])
  })

  it('adds a task to a goal with the goal’s subject', async () => {
    const goal = (await addGoal({ title: 'G', subjectId: 'calculus' }, now))!
    const plain = (await addTaskToGoal(goal.id, input('Past paper'), now))!
    const own = (await addTaskToGoal(
      goal.id,
      input('Read notes', { subjectId: 'physics' }),
      now,
    ))!
    expect(plain.subjectId).toBe('calculus')
    expect(own.subjectId).toBe('physics')
    expect(goals.find(goal.id)!.taskIds).toEqual([plain.id, own.id])
    expect(await addTaskToGoal(goal.id, input('  '), now)).toBeNull()
  })

  it('follows a repeating task from one time to the next', async () => {
    const weekly = (await addTask(
      input('Tutorial sheet', {
        due: TODAY,
        recurrence: { unit: 'week', interval: 1, weekdays: [], anchor: TODAY },
      }),
      now,
    ))!
    const once = (await addTask(input('Book the exam'), now))!
    const gone = (await addTask(input('Deleted'), now))!
    await completeTask(weekly.id, now)
    await completeTask(once.id, now)
    await deleteTask(gone.id, now)
    const linked = linkedTasks(
      [weekly.seriesId, once.seriesId, gone.seriesId, 'missing'],
      tasks.get(),
    )
    expect(linked).toHaveLength(2)
    expect(linked[0]).toMatchObject({
      kind: 'repeating',
      timesDone: 1,
      task: { due: '2026-10-17', status: 'todo' },
    })
    expect(linked[1]).toMatchObject({ kind: 'step', done: true })
  })

  it('links habits once each, and unlinks them', async () => {
    const goal = (await addGoal({ title: 'G' }, now))!
    await linkHabit(goal.id, 'h1', now)
    await linkHabit(goal.id, 'h1', now)
    await linkHabit(goal.id, 'h2', now)
    await unlinkHabit(goal.id, 'h1', later(1))
    expect(goals.find(goal.id)!.habitIds).toEqual(['h2'])
  })
})

describe('progress', () => {
  const goal = (extra: Partial<Goal> = {}): Goal => ({
    ...parseGoal(stored({ createdAt: '2026-09-30T22:00:00.000Z' }))!,
    ...extra,
  })
  const milestone = (
    id: string,
    doneAt: string | null,
    due: string | null = null,
  ) => ({
    id,
    title: id,
    due,
    doneAt,
  })
  const stamp = now.toISOString()

  it('counts milestones and one-off tasks as steps', async () => {
    const a = (await addTask(input('A'), now))!
    const b = (await addTask(input('B'), now))!
    await completeTask(a.id, now)
    const progress = goalProgress(
      goal({
        milestones: [
          milestone('m1', stamp),
          milestone('m2', null),
          milestone('m3', null),
        ],
      }),
      linkedTasks([a.id, b.id], tasks.get()),
      [],
      TODAY,
    )
    expect(progress).toMatchObject({ steps: 5, done: 2, share: 0.4 })
    expect(progress.next?.id).toBe('m2')
  })

  it('leaves repeating tasks out of the steps', async () => {
    const weekly = (await addTask(
      input('Tutorial sheet', {
        due: TODAY,
        recurrence: { unit: 'week', interval: 1, weekdays: [], anchor: TODAY },
      }),
      now,
    ))!
    await completeTask(weekly.id, now)
    const progress = goalProgress(
      goal(),
      linkedTasks([weekly.id], tasks.get()),
      [],
      TODAY,
    )
    expect(progress).toMatchObject({
      steps: 0,
      done: 0,
      share: null,
      pace: null,
    })
  })

  it('counts milestones past their day', () => {
    const progress = goalProgress(
      goal({
        milestones: [
          milestone('late', null, '2026-10-01'),
          milestone('done late', stamp, '2026-10-01'),
          milestone('today', null, TODAY),
        ],
      }),
      [],
      [],
      TODAY,
    )
    expect(progress.overdue).toBe(1)
  })

  it('compares steps done with the time gone towards the target', () => {
    // Started 1 October; the target is 31 October: a third of the way there.
    const target = '2026-10-31'
    const with2of6 = goal({
      target,
      milestones: ['a', 'b', 'c', 'd', 'e', 'f'].map((id, index) =>
        milestone(id, index < 2 ? stamp : null),
      ),
    })
    const progress = goalProgress(with2of6, [], [], TODAY)
    expect(progress.elapsed).toBeCloseTo(9 / 30)
    expect(progress.daysLeft).toBe(21)
    expect(progress.pace).toBe('on-track')

    const ahead = {
      ...with2of6,
      milestones: with2of6.milestones.map((each, index) =>
        index < 4 ? { ...each, doneAt: stamp } : each,
      ),
    }
    expect(goalProgress(ahead, [], [], TODAY).pace).toBe('ahead')
    const behind = {
      ...with2of6,
      milestones: with2of6.milestones.map((each) => ({
        ...each,
        doneAt: null,
      })),
    }
    expect(goalProgress(behind, [], [], TODAY).pace).toBe('behind')

    // Past the target and not there yet.
    const late = goalProgress(ahead, [], [], '2026-11-02')
    expect(late).toMatchObject({ pace: 'behind', daysLeft: -2, elapsed: 1 })
    // Every step done is never behind.
    const all = {
      ...with2of6,
      milestones: with2of6.milestones.map((each) => ({
        ...each,
        doneAt: stamp,
      })),
    }
    expect(goalProgress(all, [], [], '2026-11-02').pace).toBe('ahead')
  })

  it('has no pace without a target or steps', () => {
    expect(
      goalProgress(goal({ milestones: [milestone('a', null)] }), [], [], TODAY)
        .pace,
    ).toBeNull()
    expect(
      goalProgress(goal({ target: '2026-12-01' }), [], [], TODAY),
    ).toMatchObject({
      pace: null,
      share: null,
      daysLeft: 52,
    })
  })

  it('averages the linked habits’ four weeks', () => {
    expect(goalProgress(goal(), [], [0.5, null, 1], TODAY).habitRate).toBe(0.75)
    expect(goalProgress(goal(), [], [null], TODAY).habitRate).toBeNull()
  })
})
