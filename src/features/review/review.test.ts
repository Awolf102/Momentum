import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { setTaskModel, setTaskProvider } from '@/features/ai/store'
import type { Weekday } from '@/lib/date'
import { summarizeWeek, type WeekInput } from './lib/week'
import { reviewWeekToShow, weekOf } from './lib/weeks'
import {
  readWriteUp,
  REVIEW_PARTS,
  REVIEW_SYSTEM,
  reviewRequest,
  type ReviewPart,
} from './lib/writeUp'
import { mergeReview, parseReview, reviewStore } from './store'
import { NoWriteUpError, writeUpWeek } from './write'

// A stand-in chat model: the real AI client, with a scripted provider.
const model = vi.hoisted(() => ({ reply: '', calls: [] as unknown[] }))
vi.mock('@/features/ai/providers', async () => {
  const { createMockProvider } = await import('@/features/ai/providers/mock')
  const provider = createMockProvider({
    replies: () => ({ chunks: [model.reply] }),
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

beforeEach(() => {
  setTaskProvider('chat', 'compatible')
  setTaskModel('chat', 'test-chat-model', 'compatible')
})

afterEach(() => {
  model.reply = ''
  model.calls = []
  reviewStore.reset()
})

// The week of Monday 5 October 2026; "today" is the Thursday (Sydney).
const MONDAY = '2026-10-05'
const at = (day: string, time = '09:00') =>
  new Date(`${day}T${time}:00+11:00`).toISOString()
const hour = 3_600_000

function input(extra: Partial<WeekInput> = {}): WeekInput {
  return {
    start: MONDAY,
    today: '2026-10-08',
    sessions: [
      { day: '2026-10-05', subjectId: 'logic', durationMs: hour },
      { day: '2026-10-05', subjectId: 'calc', durationMs: hour / 2 },
      { day: '2026-10-07', subjectId: 'logic', durationMs: hour },
      { day: '2026-10-07', subjectId: null, durationMs: hour / 4 },
      {
        day: '2026-10-06',
        subjectId: 'calc',
        durationMs: hour,
        deletedAt: at('2026-10-06'),
      },
      // The week before.
      { day: '2026-10-02', subjectId: 'logic', durationMs: 2 * hour },
      { day: '2026-09-27', subjectId: 'logic', durationMs: hour },
    ],
    checkIns: [
      '2026-10-03',
      '2026-10-05',
      '2026-10-06',
      '2026-10-08',
      '2026-10-09',
    ],
    habits: [
      {
        id: 'run',
        name: 'Run',
        weekdays: [1, 3, 5] as Weekday[],
        createdAt: at('2026-09-01'),
      },
      {
        id: 'read',
        name: 'Read',
        weekdays: [],
        createdAt: at('2026-10-07', '08:00'),
      },
    ],
    habitDays: new Map([
      ['run', new Set(['2026-10-05', '2026-10-06', '2026-10-07'])],
      ['read', new Set(['2026-10-07', '2026-10-08'])],
    ]),
    tasks: [
      {
        title: 'Lab report',
        status: 'done',
        due: '2026-10-06',
        completedAt: at('2026-10-06', '08:30'),
        subjectId: 'logic',
      },
      {
        title: 'Last week’s task',
        status: 'done',
        due: null,
        completedAt: at('2026-10-04', '23:30'),
        subjectId: null,
      },
      {
        title: 'Early Monday',
        status: 'done',
        due: null,
        completedAt: at('2026-10-05', '07:00'),
        subjectId: null,
      },
      {
        title: 'Return books',
        status: 'todo',
        due: '2026-10-07',
        completedAt: null,
        subjectId: null,
      },
      {
        title: 'Friday essay',
        status: 'todo',
        due: '2026-10-09',
        completedAt: null,
        subjectId: null,
      },
      {
        title: 'Deleted',
        status: 'done',
        due: null,
        completedAt: at('2026-10-06'),
        subjectId: null,
        deletedAt: at('2026-10-07'),
      },
    ],
    log: [
      { day: '2026-10-07', text: '  Finished the Karnaugh lab ' },
      { day: '2026-10-05', text: 'Slow start' },
      { day: '2026-10-04', text: 'Last week' },
      { day: '2026-10-06', text: '   ' },
    ],
    goals: [
      {
        title: 'Distinction in Digital Logic',
        milestones: [
          { title: 'Lab 3', doneAt: at('2026-10-06', '18:00') },
          { title: 'Problem set', doneAt: at('2026-09-29') },
          { title: 'Midterm', doneAt: null },
        ],
      },
    ],
    subjects: new Map([
      ['logic', 'Digital Logic'],
      ['calc', 'Calculus'],
    ]),
    ...extra,
  }
}

describe('which week', () => {
  it('runs Monday to Sunday, and shows on Sundays and Mondays', () => {
    expect(weekOf('2026-10-11')).toBe(MONDAY)
    expect(weekOf(MONDAY)).toBe(MONDAY)
    expect(reviewWeekToShow('2026-10-11')).toBe(MONDAY)
    // Monday: last week's.
    expect(reviewWeekToShow('2026-10-12')).toBe(MONDAY)
    expect(reviewWeekToShow('2026-10-08')).toBeNull()
  })
})

describe('a week in numbers', () => {
  it('adds up focus, check-ins, habits, tasks, the log and milestones', () => {
    const week = summarizeWeek(input())
    expect(week.end).toBe('2026-10-11')
    expect(week.daysSoFar).toBe(4)
    expect(week.focus).toEqual({
      minutes: 165,
      sessions: 4,
      byDay: [90, 0, 75, 0, 0, 0, 0],
      bySubject: [
        { name: 'Digital Logic', minutes: 120 },
        { name: 'Calculus', minutes: 30 },
        { name: '', minutes: 15 },
      ],
      previousMinutes: 120,
    })
    // Only days so far: not Friday's check-in, nor last Saturday's.
    expect(week.checkIns).toBe(3)
    // Run is due Mon and Wed so far, and done both (a day off would not count);
    // Read began on Wednesday.
    expect(week.habits).toEqual([
      { name: 'Run', done: 2, due: 2 },
      { name: 'Read', done: 2, due: 2 },
    ])
    // Finished in the week, by the day where you are.
    expect(
      week.tasksDone.map((task) => [task.title, task.day, task.subject]),
    ).toEqual([
      ['Early Monday', '2026-10-05', ''],
      ['Lab report', '2026-10-06', 'Digital Logic'],
    ])
    expect(week.stillOpen).toEqual([
      { title: 'Return books', due: '2026-10-07' },
    ])
    expect(week.log).toEqual([
      { day: '2026-10-05', text: 'Slow start' },
      { day: '2026-10-07', text: 'Finished the Karnaugh lab' },
    ])
    expect(week.milestones).toEqual([
      {
        goal: 'Distinction in Digital Logic',
        title: 'Lab 3',
        day: '2026-10-06',
      },
    ])
    expect(week.empty).toBe(false)
  })

  it('knows a week when nothing happened', () => {
    const week = summarizeWeek(
      input({ start: '2026-11-02', today: '2026-11-08', habitDays: new Map() }),
    )
    expect(week.empty).toBe(true)
    expect(week.daysSoFar).toBe(7)
    expect(week.habits).toEqual([
      { name: 'Run', done: 0, due: 3 },
      { name: 'Read', done: 0, due: 7 },
    ])
  })
})

describe('the write-up', () => {
  const all = new Set<ReviewPart>(REVIEW_PARTS)

  it('sends the week, part by part', () => {
    const text = reviewRequest(summarizeWeek(input()), all)
    expect(text).toContain(
      'The week of Mon 5 Oct to Sun 11 Oct (4 of its 7 days so far).',
    )
    expect(text).toContain(
      'Focus: 2 h 45 min over 4 sessions (the week before: 2 h).',
    )
    expect(text).toContain(
      '- By day: Mon 1 h 30 min, Tue 0 min, Wed 1 h 15 min, Thu 0 min',
    )
    expect(text).toContain(
      '- By subject: Digital Logic 2 h, Calculus 30 min, no subject 15 min',
    )
    expect(text).toContain('Daily check-ins: 3 of 4 days.')
    expect(text).toContain('- “Run”: 2 of 2')
    expect(text).toContain('- Tue 6 Oct: “Lab report” (Digital Logic)')
    expect(text).toContain(
      'Due this week and still open (1):\n- “Return books” (due Wed 7 Oct)',
    )
    expect(text).toContain(
      '- Tue 6 Oct: “Lab 3”, towards “Distinction in Digital Logic”',
    )
    expect(text).toContain('- Wed 7 Oct: “Finished the Karnaugh lab”')
  })

  it('leaves out what isn’t ticked', () => {
    const text = reviewRequest(
      summarizeWeek(input()),
      new Set<ReviewPart>(['habits']),
    )
    expect(text).toContain('“Run”')
    expect(text).not.toMatch(/Focus|check-ins|Lab report|Lab 3|Karnaugh/)
  })

  it('reads the reply, with or without prose around it', () => {
    expect(
      readWriteUp(
        'Here you go:\n{"went_well": "Lots of logic.", "slipped": "Books.", "next_week": "Return them."}',
      ),
    ).toEqual({
      wentWell: 'Lots of logic.',
      slipped: 'Books.',
      nextWeek: 'Return them.',
    })
    expect(readWriteUp('{"wentWell": "Good", "nextWeek": "More"}')).toEqual({
      wentWell: 'Good',
      slipped: '',
      nextWeek: 'More',
    })
    expect(readWriteUp('Sorry, I can’t.')).toBeNull()
    expect(readWriteUp('{"went_well": ""}')).toBeNull()
  })

  it('is written by the chat model and kept for its week', async () => {
    const week = summarizeWeek(input())
    const parts = new Set<ReviewPart>(['focus', 'tasks'])
    model.reply =
      '{"went_well": "Two hours of logic.", "slipped": "The books.", "next_week": "Return them Monday."}'
    const written = await writeUpWeek(week, parts, {})
    const request = model.calls[0] as {
      system: string
      messages: Array<{ content: string }>
    }
    expect(request.system).toBe(REVIEW_SYSTEM)
    expect(request.messages[0].content).toBe(reviewRequest(week, parts))
    expect(written).toMatchObject({
      wentWell: 'Two hours of logic.',
      nextWeek: 'Return them Monday.',
    })
    expect(reviewStore.get().written[MONDAY]).toEqual(written)
    model.reply = 'Nothing to say.'
    await expect(writeUpWeek(week, parts, {})).rejects.toBeInstanceOf(
      NoWriteUpError,
    )
  })
})

describe('what’s kept', () => {
  it('reads back write-ups and the setting, dropping what it can’t use', () => {
    expect(parseReview({})).toEqual({ onSundays: true, written: {} })
    expect(
      parseReview({
        onSundays: false,
        written: {
          [MONDAY]: {
            wentWell: 'Good',
            slipped: '',
            nextWeek: '',
            at: '2026-10-11T09:00:00.000Z',
          },
          'not a day': { wentWell: 'x', at: 'y' },
          '2026-09-28': { wentWell: '', slipped: '', nextWeek: '', at: 'z' },
        },
      }),
    ).toEqual({
      onSundays: false,
      written: {
        [MONDAY]: {
          wentWell: 'Good',
          slipped: '',
          nextWeek: '',
          at: '2026-10-11T09:00:00.000Z',
        },
      },
    })
  })

  it('keeps the later write-up when a backup has one too, and this device’s setting', () => {
    const mine = {
      onSundays: false,
      written: {
        [MONDAY]: {
          wentWell: 'Mine',
          slipped: '',
          nextWeek: '',
          at: '2026-10-11T09:00:00.000Z',
        },
      },
    }
    const theirs = {
      onSundays: true,
      written: {
        [MONDAY]: {
          wentWell: 'Theirs',
          slipped: '',
          nextWeek: '',
          at: '2026-10-11T10:00:00.000Z',
        },
        '2026-09-28': {
          wentWell: 'Older',
          slipped: '',
          nextWeek: '',
          at: '2026-10-04T10:00:00.000Z',
        },
      },
    }
    const merged = mergeReview(mine, theirs)
    expect(merged.onSundays).toBe(false)
    expect(merged.written[MONDAY].wentWell).toBe('Theirs')
    expect(merged.written['2026-09-28'].wentWell).toBe('Older')
  })
})
