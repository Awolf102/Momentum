import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { setTaskModel, setTaskProvider } from '@/features/ai/store'
import { goals } from '@/features/goals/data'
import { addGoal, linkTask } from '@/features/goals/actions'
import {
  addHabit,
  habitCheckIns,
  habitsStore,
  toggleHabit,
} from '@/features/habits'
import { addTask, completeTask, tasks, type NewTask } from '@/features/tasks'
import { addBlock } from './actions'
import { blocks } from './blocks'
import { calendars } from './calendars'
import {
  clock24,
  longDay,
  MAX_DRAFTS,
  PLAN_SYSTEM,
  planRequest,
  planWindow,
  readPlan,
  type PlanContext,
} from './lib/draft'
import {
  addDraft,
  changeDraft,
  draftPlan,
  gatherPlanContext,
  PLAN_PARTS,
  planDraftStore,
  removeAdded,
  showDraft,
  type PlanPart,
} from './planMyDay'
import type { Calendar } from './types'

// A stand-in chat model: the real AI client, with a provider that answers
// from a script and keeps what it was sent.
const model = vi.hoisted(() => ({
  reply: '',
  calls: [] as unknown[],
  stopReason: 'end' as 'end' | 'max-tokens',
}))
vi.mock('@/features/ai/providers', async () => {
  const { createMockProvider } = await import('@/features/ai/providers/mock')
  const provider = createMockProvider({
    replies: () => ({ chunks: [model.reply], stopReason: model.stopReason }),
  })
  return {
    createProvider: () => ({
      ...provider,
      chat: (request: unknown) => {
        model.calls.push(request)
        return provider.chat(request as never)
      },
    }),
  }
})

// Monday 12 October 2026, 2:02 pm in Sydney.
const DAY = '2026-10-12'
const NOW = new Date('2026-10-12T14:02:00+11:00')
const NOW_MINUTES = 14 * 60 + 2
const ALL = new Set<PlanPart>(PLAN_PARTS)

beforeEach(() => {
  setTaskProvider('chat', 'compatible')
  setTaskModel('chat', 'test-chat-model', 'compatible')
})

afterEach(async () => {
  model.reply = ''
  model.calls = []
  planDraftStore.set(null)
  habitsStore.reset()
  await Promise.all([
    tasks.clear(),
    blocks.clear(),
    calendars.clear(),
    goals.clear(),
    habitCheckIns.clear(),
  ])
})

const input = (title: string, extra: Partial<NewTask> = {}): NewTask => ({
  title,
  due: null,
  time: null,
  subjectId: null,
  priority: 0,
  recurrence: null,
  ...extra,
})

function timetable(): Calendar {
  const event = (
    uid: string,
    title: string,
    minutes: number,
    length: number,
  ) => ({
    uid,
    title,
    location: '',
    start: { date: DAY, minutes, zone: null },
    length,
    rule: null,
    except: [],
  })
  return {
    id: 'uni',
    name: 'Timetable',
    color: 'sky',
    hidden: false,
    fileName: 'uni.ics',
    importedAt: NOW.toISOString(),
    events: [
      event('lecture', 'ELEC2141 Lecture', 9 * 60, 60),
      event('lab', 'ELEC2141 Lab', 15 * 60, 60),
    ],
    createdAt: NOW.toISOString(),
    updatedAt: NOW.toISOString(),
    deletedAt: null,
  }
}

const context = (extra: Partial<PlanContext> = {}): PlanContext => ({
  day: DAY,
  now: NOW_MINUTES,
  from: 14 * 60 + 15,
  until: 22 * 60,
  focusMinutes: 25,
  busy: [
    { start: 15 * 60, end: 16 * 60, title: 'ELEC2141 Lab', kind: 'event' },
    { start: 17 * 60 + 15, end: 18 * 60 + 45, title: null, kind: 'block' },
  ],
  tasks: [
    {
      id: 'library',
      title: 'Return library books',
      due: '2026-10-10',
      time: null,
      priority: 2,
      subjectId: null,
      subject: '',
      goal: null,
    },
    {
      id: 'report',
      title: 'Lab report: adder circuits',
      due: DAY,
      time: '17:00',
      priority: 3,
      subjectId: 'digital-logic',
      subject: 'Digital Logic',
      goal: 'Distinction in Digital Logic',
    },
    {
      id: 'trip',
      title: 'Plan the "summer" trip',
      due: null,
      time: null,
      priority: 0,
      subjectId: null,
      subject: '',
      goal: null,
    },
  ],
  goals: [
    {
      title: 'Distinction in Digital Logic',
      target: '2026-11-21',
      next: 'Midterm',
      nextDue: '2026-10-17',
    },
  ],
  habits: ['Run'],
  subjects: [
    { id: 'calculus', name: 'Calculus' },
    { id: 'digital-logic', name: 'Digital Logic' },
  ],
  ...extra,
})

describe('the time to plan', () => {
  it('starts at the next quarter hour today, and 8:00 another day', () => {
    expect(planWindow(DAY, DAY, NOW_MINUTES)).toEqual({
      from: 14 * 60 + 15,
      until: 22 * 60,
    })
    // Five minutes' grace: at 2:12 there's no point planning 2:15.
    expect(planWindow(DAY, DAY, 14 * 60 + 12)?.from).toBe(14 * 60 + 30)
    expect(planWindow('2026-10-13', DAY, NOW_MINUTES)).toEqual({
      from: 8 * 60,
      until: 22 * 60,
    })
  })

  it('runs late into the night, but not past it', () => {
    expect(planWindow(DAY, DAY, 23 * 60 + 20)).toEqual({
      from: 23 * 60 + 30,
      until: 24 * 60,
    })
    expect(planWindow(DAY, DAY, 23 * 60 + 40)).toBeNull()
    expect(planWindow('2026-10-11', DAY, NOW_MINUTES)).toBeNull()
  })
})

describe('the request', () => {
  it('says the day, what’s busy and what’s to do', () => {
    const text = planRequest(context())
    expect(text).toContain(
      "Plan Monday 12 October, from 14:15 until 22:00. It's 14:02 now.",
    )
    expect(text).toContain('Focus sessions are 25 minutes.')
    expect(text).toContain('- 15:00–16:00: “ELEC2141 Lab” (calendar)')
    // A block whose title isn't shared is just busy.
    expect(text).toContain('- 17:15–18:45: busy')
    expect(text).toContain(
      'T1. “Return library books”: overdue (was due Saturday 10 October, 2 days ago), medium priority',
    )
    expect(text).toContain(
      'T2. “Lab report: adder circuits”: due that day at 17:00, high priority, Digital Logic, towards the goal “Distinction in Digital Logic”',
    )
    // Quotes in titles can't end the quote early.
    expect(text).toContain("T3. “Plan the 'summer' trip”: no date")
    expect(text).toContain(
      '- “Distinction in Digital Logic”: reach it by Saturday 21 November; next milestone “Midterm” by Saturday 17 October',
    )
    expect(text).toContain('Habits still to do that day: “Run”')
    expect(text).toContain('Subjects: Calculus, Digital Logic')
  })

  it('says when nothing is shared', () => {
    const text = planRequest(
      context({ now: null, busy: [], tasks: [], goals: [], habits: [] }),
    )
    expect(text).toContain('Plan Monday 12 October, from 14:15 until 22:00.')
    expect(text).not.toContain('now.')
    expect(text).toContain('Already busy (don’t plan over these):\n- nothing')
    expect(text).toContain('Tasks: none shared.')
    expect(text).not.toContain('Goals:')
    expect(text).not.toContain('Habits')
  })

  it('writes days and times the same everywhere', () => {
    expect(longDay('2027-01-01')).toBe('Friday 1 January')
    expect(clock24(0)).toBe('00:00')
    expect(clock24(9 * 60 + 5)).toBe('09:05')
    expect(clock24(24 * 60)).toBe('00:00')
  })
})

describe('reading the reply', () => {
  const reply = (blocks: unknown[], note = 'A steady afternoon.') =>
    JSON.stringify({ blocks, note })

  it('fits suggestions to the day, leaving out what can’t be done', () => {
    const draft = readPlan(
      'Here is your plan:\n```json\n' +
        reply([
          {
            start: '14:20',
            end: '15:00',
            kind: 'task',
            task: 'T2',
            title: 'Report',
            why: 'Due at five',
          },
          {
            start: '15:30',
            end: '16:30',
            kind: 'focus',
            subject: 'Calculus',
            title: 'Limits',
            why: 'Over the lab',
          },
          {
            start: '16:00',
            end: '17:10',
            kind: 'focus',
            subject: 'calculus',
            title: 'Revise limits',
            why: 'Quiz soon',
          },
          {
            start: '7:30 pm',
            end: '8:00 PM',
            kind: 'other',
            title: 'Run',
            why: 'Habit',
          },
          {
            start: '19:45',
            end: '20:30',
            kind: 'other',
            title: 'Overlaps the run',
            why: '',
          },
          {
            start: '21:30',
            end: '23:00',
            kind: 'task',
            task: 1,
            why: 'Past the end',
          },
          { start: '20:30', end: '20:35', kind: 'other', title: 'Too short' },
          { start: 'soon', end: '21:00', kind: 'other', title: 'No time' },
          { start: '20:45', end: '21:15', kind: 'other', why: 'No title' },
          {
            start: '20:45',
            end: '21:15',
            kind: 'focus',
            subject: 'Underwater basket weaving',
            why: '',
          },
        ]) +
        '\n```',
      context(),
    )
    expect(draft.note).toBe('A steady afternoon.')
    expect(
      draft.blocks.map((block) => [
        clock24(block.start),
        clock24(block.end),
        block.kind,
        block.title,
      ]),
    ).toEqual([
      ['14:15', '15:00', 'task', 'Lab report: adder circuits'],
      ['16:00', '17:15', 'focus', 'Revise limits'],
      ['19:30', '20:00', 'other', 'Run'],
      ['20:45', '21:15', 'focus', ''],
      ['21:30', '22:00', 'task', 'Return library books'],
    ])
    expect(draft.blocks[0]).toMatchObject({
      taskId: 'report',
      subjectId: 'digital-logic',
      why: 'Due at five',
    })
    expect(draft.blocks[1].subjectId).toBe('calculus')
    // A subject it doesn't know is left off; "other" has none.
    expect(draft.blocks[3].subjectId).toBeNull()
    expect(draft.blocks[2].subjectId).toBeNull()
    expect(draft.dropped).toBe(5)
  })

  it('keeps to the most it takes, and copes with nothing usable', () => {
    const many = Array.from({ length: MAX_DRAFTS + 3 }, (_, index) => ({
      start: clock24(8 * 60 + index * 30),
      end: clock24(8 * 60 + index * 30 + 15),
      kind: 'other',
      title: `Step ${index}`,
    }))
    const wide = context({ from: 8 * 60, until: 24 * 60, busy: [] })
    const draft = readPlan(reply(many), wide)
    expect(draft.blocks).toHaveLength(MAX_DRAFTS)
    expect(draft.dropped).toBe(3)
    expect(readPlan('I can’t plan that.', context())).toEqual({
      blocks: [],
      note: '',
      dropped: 0,
    })
    expect(readPlan('{"blocks": "none"}', context()).blocks).toEqual([])
  })
})

describe('what’s shared', () => {
  async function setUp() {
    await calendars.add(timetable())
    const overdue = await addTask(
      input('Return library books', { due: '2026-10-10', priority: 2 }),
      NOW,
    )
    const report = await addTask(
      input('Lab report: adder circuits', {
        due: DAY,
        time: '17:00',
        priority: 3,
        subjectId: 'digital-logic',
      }),
      NOW,
    )
    await addTask(
      input('Calculus quiz revision', {
        due: '2026-10-20',
        subjectId: 'calculus',
      }),
      NOW,
    )
    await addTask(input('Christmas cards', { due: '2026-12-01' }), NOW)
    await addTask(input('Plan the summer trip', { priority: 1 }), NOW)
    const done = await addTask(input('Email tutor', { due: DAY }), NOW)
    await completeTask(done!.id, NOW)
    const planned = await addTask(input('Already planned', { due: DAY }), NOW)
    await addBlock(
      {
        day: DAY,
        start: 17 * 60 + 15,
        end: 18 * 60 + 45,
        kind: 'task',
        taskId: planned!.id,
      },
      NOW,
    )
    await addBlock(
      { day: DAY, start: 12 * 60, end: 13 * 60, kind: 'other', title: 'Lunch' },
      NOW,
    )
    const goal = await addGoal(
      {
        title: 'Distinction in Digital Logic',
        target: '2026-11-21',
        milestones: ['Karnaugh maps', 'Midterm'],
      },
      NOW,
    )
    await linkTask(goal!.id, report!.seriesId, NOW)
    addHabit('Run', [], NOW)
    const read = addHabit('Read', [], NOW)!
    addHabit('Gym', [6], NOW)
    await toggleHabit(read.id, DAY, NOW)
    return { overdue: overdue!, report: report! }
  }

  it('sends the day’s events and blocks, open tasks by urgency, goals and habits', async () => {
    const { overdue, report } = await setUp()
    const shared = gatherPlanContext(
      DAY,
      { from: 14 * 60 + 15, until: 22 * 60 },
      NOW_MINUTES,
      ALL,
    )
    // Only what's in the time to plan: not the morning's lecture or lunch.
    expect(shared.busy).toEqual([
      { start: 15 * 60, end: 16 * 60, title: 'ELEC2141 Lab', kind: 'event' },
      {
        start: 17 * 60 + 15,
        end: 18 * 60 + 45,
        title: 'Already planned',
        kind: 'block',
      },
    ])
    expect(shared.tasks.map((task) => task.title)).toEqual([
      'Return library books',
      'Lab report: adder circuits',
      'Calculus quiz revision',
      'Plan the summer trip',
    ])
    expect(shared.tasks[0].id).toBe(overdue.id)
    expect(shared.tasks[1]).toMatchObject({
      id: report.id,
      subject: 'Digital Logic',
      goal: 'Distinction in Digital Logic',
    })
    expect(shared.goals).toEqual([
      {
        title: 'Distinction in Digital Logic',
        target: '2026-11-21',
        next: 'Karnaugh maps',
        nextDue: null,
      },
    ])
    expect(shared.habits).toEqual(['Run'])
    expect(shared.focusMinutes).toBe(25)
    expect(shared.subjects.map((subject) => subject.name)).toContain('Calculus')
  })

  it('leaves out what isn’t ticked, but keeps the busy times', async () => {
    await setUp()
    const shared = gatherPlanContext(
      DAY,
      { from: 14 * 60 + 15, until: 22 * 60 },
      NOW_MINUTES,
      new Set<PlanPart>(),
    )
    expect(shared.busy.map((busy) => busy.title)).toEqual([null, null])
    expect(shared.busy.map((busy) => busy.start)).toEqual([
      15 * 60,
      17 * 60 + 15,
    ])
    expect(shared).toMatchObject({ tasks: [], goals: [], habits: [] })
    const text = planRequest(shared)
    expect(text).not.toContain('ELEC2141')
    expect(text).not.toContain('Already planned')
    // Tasks without goals: the goal isn't named.
    const noGoals = gatherPlanContext(
      DAY,
      { from: 14 * 60 + 15, until: 22 * 60 },
      NOW_MINUTES,
      new Set<PlanPart>(['tasks']),
    )
    expect(noGoals.tasks.every((task) => task.goal === null)).toBe(true)
  })
})

describe('drafting a day', () => {
  it('sends the request to the chat model and fits its reply', async () => {
    const shared = context()
    model.reply = JSON.stringify({
      blocks: [
        {
          start: '14:15',
          end: '15:00',
          kind: 'task',
          task: 'T2',
          why: 'Due at five',
        },
        {
          start: '16:00',
          end: '17:00',
          kind: 'focus',
          subject: 'Calculus',
          title: 'Limits',
          why: 'Quiz soon',
        },
      ],
      note: 'The report first.',
    })
    const draft = await draftPlan(shared)
    expect(model.calls).toHaveLength(1)
    const request = model.calls[0] as {
      system: string
      messages: Array<{ role: string; content: string }>
    }
    expect(request.system).toBe(PLAN_SYSTEM)
    expect(request.messages).toEqual([
      { role: 'user', content: planRequest(shared) },
    ])
    expect(draft.note).toBe('The report first.')
    expect(draft.blocks.map((block) => block.title)).toEqual([
      'Lab report: adder circuits',
      'Limits',
    ])
    expect(draft.cutOff).toBeUndefined()
    expect(model.calls[0]).toMatchObject({ thinking: false })
  })

  it('keeps the whole blocks of a reply cut off at the length limit', async () => {
    const shared = context()
    model.stopReason = 'max-tokens'
    model.reply =
      '{"blocks": [{"start": "16:00", "end": "17:00", "kind": "focus", "subject": "Calculus", "title": "Limits", "why": "Quiz soon"}, {"start": "17:'
    const draft = await draftPlan(shared)
    model.stopReason = 'end'
    expect(draft.cutOff).toBe(true)
    expect(draft.blocks.map((block) => block.title)).toEqual(['Limits'])
  })

  it('puts the kept blocks on the plan, as changed, and Undo takes them off', async () => {
    showDraft(
      DAY,
      readPlan(
        JSON.stringify({
          blocks: [
            { start: '14:15', end: '15:00', kind: 'task', task: 'T2', why: '' },
            {
              start: '16:00',
              end: '17:00',
              kind: 'focus',
              subject: 'Calculus',
              title: 'Limits',
              why: '',
            },
            {
              start: '19:30',
              end: '20:00',
              kind: 'other',
              title: 'Run',
              why: '',
            },
          ],
          note: '',
        }),
        context(),
      ),
    )
    const [report, limits, run] = planDraftStore.get()!.blocks
    changeDraft(run.key, { keep: false })
    changeDraft(limits.key, {
      start: 16 * 60 + 15,
      end: 17 * 60 + 15,
      title: 'Revise limits',
    })
    const added = await addDraft(NOW)
    expect(planDraftStore.get()).toBeNull()
    expect(
      blocks
        .get()
        .map((block) => [
          block.day,
          block.start,
          block.end,
          block.kind,
          block.title,
          block.taskId,
          block.subjectId,
        ]),
    ).toEqual([
      [
        DAY,
        report.start,
        report.end,
        'task',
        'Lab report: adder circuits',
        'report',
        'digital-logic',
      ],
      [
        DAY,
        16 * 60 + 15,
        17 * 60 + 15,
        'focus',
        'Revise limits',
        null,
        'calculus',
      ],
    ])
    await removeAdded(added)
    expect(blocks.get()).toEqual([])
  })
})
