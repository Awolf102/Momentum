import { describe, expect, it } from 'vitest'
import type { Message } from '../types'
import { buildIndex, countTerms, fuse, rank, stem, terms } from './bm25'
import {
  chatMessages,
  findCitations,
  MAX_HISTORY,
  questionContent,
  sourcesBlock,
  titleFrom,
} from './prompt'
import { joinPassages, mergeByPage } from './passages'
import { dayName, plannerSnapshot, type SnapshotData } from './snapshot'

describe('terms', () => {
  it('folds, drops common words and stems', () => {
    expect(
      terms('How do Karnaugh maps simplify the Boolean functions?'),
    ).toEqual(['karnaugh', 'map', 'simplify', 'boolean', 'function'])
    expect(stem('grouping')).toBe('group')
    expect(stem('simplified')).toBe('simplify')
    expect(stem('studies')).toBe('study')
    expect(stem('class')).toBe('class')
    expect(stem('analysis')).toBe('analysis')
    expect(terms('Gödel’s théorème')).toEqual(['godel', 'theoreme'])
  })
})

describe('rank', () => {
  const passages = [
    'A Karnaugh map groups ones in powers of two to simplify a function.',
    'Gray code orders rows so neighbouring cells differ in one bit.',
    'Boil the penne, then bake with tomato sauce and mozzarella.',
    'Karnaugh maps work up to five variables; beyond that use Quine–McCluskey.',
  ]
  const index = buildIndex(passages.map((text) => countTerms(text, text)))

  it('ranks passages by the words they share with a question', () => {
    const found = rank(index, 'How do I group ones in a Karnaugh map?', 5)
    expect(found[0].item).toBe(passages[0])
    expect(found.map((hit) => hit.item)).not.toContain(passages[2])
  })

  it("doesn't need every word to appear", () => {
    expect(rank(index, 'neighbouring cells in a table', 5)[0].item).toBe(
      passages[1],
    )
  })

  it('can be limited to some items, and finds nothing in common words', () => {
    const found = rank(index, 'karnaugh', 5, (text) => text.includes('five'))
    expect(found.map((hit) => hit.item)).toEqual([passages[3]])
    expect(rank(index, 'how is it the', 5)).toEqual([])
  })
})

describe('fuse', () => {
  it('puts what both lists found first', () => {
    const byWords = ['a', 'b', 'c']
    const byMeaning = ['d', 'b', 'e']
    expect(fuse([byWords, byMeaning], (item) => item)).toEqual([
      'b',
      'a',
      'd',
      'c',
      'e',
    ])
  })
})

const message = (
  role: Message['role'],
  text: string,
  extra: Partial<Message> = {},
): Message => ({
  id: `${role}-${text}`,
  role,
  text,
  createdAt: '2026-10-10T00:00:00.000Z',
  ...extra,
})

describe('joining passages', () => {
  it('keeps the sentence two neighbours share once', () => {
    expect(
      joinPassages(
        'Maps group ones. Gray code helps.',
        'Gray code helps. Done.',
      ),
    ).toBe('Maps group ones. Gray code helps. Done.')
    expect(joinPassages('One idea.', 'Another idea.')).toBe(
      'One idea. Another idea.',
    )
    // Only whole words are shared.
    expect(joinPassages('They embark.', 'bark. Then sail.')).toBe(
      'They embark. bark. Then sail.',
    )
  })

  it('makes one passage per page, in reading order', () => {
    const passage = (key: string, page: number | null, text: string) => ({
      key,
      page,
      text,
    })
    expect(
      mergeByPage([
        { item: passage('doc', 2, 'Middle. End.'), position: 4 },
        { item: passage('note', null, 'A note.'), position: 0 },
        { item: passage('doc', 2, 'Start. Middle.'), position: 3 },
        { item: passage('doc', 2, 'Much later.'), position: 7 },
        { item: passage('doc', 3, 'Next page.'), position: 8 },
      ]),
    ).toEqual([
      passage('doc', 2, 'Start. Middle. End. … Much later.'),
      passage('note', null, 'A note.'),
      passage('doc', 3, 'Next page.'),
    ])
  })
})

describe('the request', () => {
  const sources = [
    {
      key: 'document:d1',
      kind: 'document' as const,
      id: 'd1',
      title: 'Lecture 5',
      page: 3,
      text: 'Gray code orders rows.',
    },
    {
      key: 'note:n1',
      kind: 'note' as const,
      id: 'n1',
      title: 'Simplifying logic',
      page: null,
      text: 'Combine terms that differ in one variable.',
    },
  ]

  it('numbers the passages, with their titles and pages', () => {
    expect(sourcesBlock(sources)).toBe(
      '[1] Lecture 5, page 3 (document)\nGray code orders rows.\n\n[2] Simplifying logic (note)\nCombine terms that differ in one variable.',
    )
    expect(questionContent('Why Gray code?', { sources })).toMatch(
      /^<sources>\n\[1\] Lecture 5[\s\S]*<\/sources>\n\nQuestion: Why Gray code\?$/,
    )
    expect(questionContent('Why?', { sources: [] })).toMatch(
      /No passages .* matched/,
    )
    expect(questionContent('Busy?', { snapshot: 'Tasks (0 open)' })).toBe(
      '<snapshot>\nTasks (0 open)\n</snapshot>\n\nQuestion: Busy?',
    )
  })

  it('sends earlier messages as written, alternating, without failures', () => {
    const history = [
      message('user', 'First question', { sources }),
      message('assistant', 'First answer [1]'),
      message('user', 'Second question'),
      message('assistant', '', { error: 'Network' }),
    ]
    expect(chatMessages(history, 'Third, with context')).toEqual([
      { role: 'user', content: 'First question' },
      { role: 'assistant', content: 'First answer [1]' },
      { role: 'user', content: 'Second question\n\nThird, with context' },
    ])
  })

  it('keeps only the last few messages, starting with a question', () => {
    const history = Array.from({ length: 30 }, (_, i) =>
      message(i % 2 ? 'assistant' : 'user', `m${i}`),
    )
    const sent = chatMessages(history, 'latest')
    expect(sent.length).toBeLessThanOrEqual(MAX_HISTORY + 1)
    expect(sent[0].role).toBe('user')
    expect(sent.at(-1)).toEqual({ role: 'user', content: 'latest' })
  })

  it('titles a conversation from its first line', () => {
    expect(titleFrom('  What is a  latch?\nMore detail')).toBe(
      'What is a latch?',
    )
    expect(titleFrom('x'.repeat(100))).toHaveLength(80)
  })
})

describe('findCitations', () => {
  it('finds numbers that match a source', () => {
    const text = 'Gray code [1]. Both [1, 2]. Not [3] or [0] or [a].'
    expect(findCitations(text, 2)).toEqual([
      { start: 10, end: 13, numbers: [1] },
      { start: 20, end: 26, numbers: [1, 2] },
    ])
  })
})

describe('plannerSnapshot', () => {
  const data: SnapshotData = {
    today: '2026-10-10',
    weekStartsOn: 1,
    streak: { current: 22, longest: 40, checkedInToday: true },
    tasks: [
      {
        title: 'Return library books',
        status: 'todo',
        due: '2026-10-09',
        time: null,
        priority: 3,
        subject: '',
        repeats: false,
        doneOn: null,
      },
      {
        title: 'Calculus quiz revision',
        status: 'todo',
        due: '2026-10-10',
        time: '09:00',
        priority: 0,
        subject: 'Calculus',
        repeats: false,
        doneOn: null,
      },
      {
        title: 'Lab report',
        status: 'doing',
        due: '2026-10-12',
        time: null,
        priority: 2,
        subject: 'Digital Logic',
        repeats: false,
        doneOn: null,
      },
      {
        title: 'Gym',
        status: 'todo',
        due: null,
        time: null,
        priority: 0,
        subject: '',
        repeats: true,
        doneOn: null,
      },
      {
        title: 'Problem set 4',
        status: 'done',
        due: '2026-10-08',
        time: null,
        priority: 0,
        subject: '',
        repeats: false,
        doneOn: '2026-10-08',
      },
    ],
    habits: [
      {
        name: 'Read a chapter',
        schedule: 'Every day',
        current: 4,
        longest: 9,
        rate: 0.82,
        dueToday: true,
        doneToday: false,
      },
    ],
    routines: [{ name: 'Morning', part: 'morning', steps: 3, due: 7, done: 5 }],
    focus: new Map([
      [
        '2026-10-10',
        {
          minutes: 75,
          bySubject: new Map([
            ['Calculus', 50],
            ['', 25],
          ]),
        },
      ],
      [
        '2026-10-06',
        { minutes: 120, bySubject: new Map([['Digital Logic', 120]]) },
      ],
      ['2026-10-01', { minutes: 60, bySubject: new Map([['Calculus', 60]]) }],
    ]),
    log: [
      { day: '2026-10-09', text: 'Finished the DFA lab' },
      { day: '2026-09-01', text: 'Too long ago' },
    ],
  }

  it('describes days the same everywhere', () => {
    expect(dayName('2026-10-09')).toBe('Fri 9 Oct')
  })

  it('includes only the parts chosen', () => {
    const tasksOnly = plannerSnapshot(data, new Set(['tasks']))
    expect(tasksOnly).toContain('Daily streak: 22 days (checked in today)')
    expect(tasksOnly).toContain(
      'Overdue:\n- Return library books (Fri 9 Oct, high priority)',
    )
    expect(tasksOnly).toContain(
      'Due today:\n- Calculus quiz revision (09:00, Calculus)',
    )
    expect(tasksOnly).toContain(
      '- Lab report (Mon 12 Oct, Digital Logic, medium priority, in progress)',
    )
    expect(tasksOnly).toContain('No date:\n- Gym (repeats)')
    expect(tasksOnly).toContain(
      'Finished in the last 7 days: 1 (Problem set 4)',
    )
    expect(tasksOnly).not.toContain('Habits')
    expect(tasksOnly).not.toContain('DFA')
  })

  it('sums focus by week and subject, and lists recent log lines', () => {
    const text = plannerSnapshot(
      data,
      new Set(['habits', 'routines', 'focus', 'log']),
    )
    expect(text).toContain(
      '- Read a chapter (Every day): due today, not done yet; current run 4, longest 9; 82% of due days in the last 4 weeks',
    )
    expect(text).toContain(
      '- Morning (morning, 3 steps): finished 5 of 7 due days in the last week',
    )
    expect(text).toContain(
      '- Today: 1 h 15 min (Calculus 50 min, no subject 25 min)',
    )
    expect(text).toContain('- This week (since Mon 5 Oct): 3 h 15 min')
    expect(text).toContain('- Last week: 1 h (Calculus 1 h)')
    expect(text).toContain('- Fri 9 Oct: Finished the DFA lab')
    expect(text).not.toContain('Too long ago')
    expect(text).not.toContain('Tasks (')
  })
})
