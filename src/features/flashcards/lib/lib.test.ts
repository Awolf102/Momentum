import { describe, expect, it } from 'vitest'
import type { FlashCard, Schedule } from '../types'
import { describeInterval, describeWhen } from './format'
import { buildQueue, dueCounts, endOfDay, newLeft, nextDue } from './queue'
import { fromFsrs, toFsrs } from './fsrs'
import { newSchedule, parseSchedule } from './schedule'
import { cardsInNote, parseSuggestedCards } from './text'

const NOW = new Date('2026-10-10T09:00:00+11:00')
const at = (iso: string) => new Date(iso).toISOString()

let count = 0
function card(
  schedule: Partial<Schedule>,
  extra: Partial<FlashCard> = {},
): FlashCard {
  count++
  return {
    id: `c${count}`,
    front: `Question ${count}`,
    back: `Answer ${count}`,
    subjectId: null,
    source: null,
    schedule: { ...newSchedule(new Date('2026-10-01T00:00:00Z')), ...schedule },
    introducedOn: null,
    createdAt: `2026-10-01T00:00:${String(count).padStart(2, '0')}.000Z`,
    updatedAt: '2026-10-01T00:00:00.000Z',
    deletedAt: null,
    ...extra,
  }
}

describe('schedules', () => {
  it('go to FSRS and back unchanged', () => {
    const schedule: Schedule = {
      state: 'review',
      due: at('2026-10-14T09:00:00Z'),
      stability: 4.5,
      difficulty: 5.2,
      scheduledDays: 4,
      learningSteps: 0,
      reps: 3,
      lapses: 1,
      lastReview: at('2026-10-10T09:00:00Z'),
    }
    const fsrs = toFsrs(schedule)
    expect(fsrs.state).toBe(2)
    expect(fsrs.due).toEqual(new Date(schedule.due))
    expect(fromFsrs(fsrs)).toEqual(schedule)
    expect(fromFsrs(toFsrs(newSchedule(NOW)))).toEqual(newSchedule(NOW))
  })

  it('start afresh when stored ones are damaged', () => {
    expect(parseSchedule({ state: 'review', due: 'soon' }, NOW)).toEqual(
      newSchedule(NOW),
    )
    expect(parseSchedule(null, NOW)).toEqual(newSchedule(NOW))
    expect(
      parseSchedule(
        {
          state: 'learning',
          due: '2026-10-10T00:00:00Z',
          difficulty: 42,
          reps: -2,
          stability: 'x',
        },
        NOW,
      ),
    ).toMatchObject({
      state: 'learning',
      difficulty: 10,
      reps: 0,
      stability: 0,
    })
  })
})

describe('the queue', () => {
  const options = { now: NOW, newPerDay: 2 }

  it('puts due steps first, then reviews due today, then new cards', () => {
    const fresh1 = card({})
    const review = card({
      state: 'review',
      due: at('2026-10-10T20:00:00+11:00'),
    })
    const overdue = card({
      state: 'review',
      due: at('2026-10-08T09:00:00+11:00'),
    })
    const step = card({
      state: 'learning',
      due: at('2026-10-10T09:05:00+11:00'),
    })
    const later = card({
      state: 'learning',
      due: at('2026-10-10T11:00:00+11:00'),
    })
    const tomorrow = card({
      state: 'review',
      due: at('2026-10-11T08:00:00+11:00'),
    })
    const fresh2 = card({})
    const fresh3 = card({})
    const all = [fresh1, review, overdue, step, later, tomorrow, fresh2, fresh3]
    expect(buildQueue(all, options).map((each) => each.id)).toEqual([
      step.id,
      overdue.id,
      review.id,
      fresh1.id,
      fresh2.id,
    ])
    // The step due later today counts as due today, not as due now.
    expect(dueCounts(all, options)).toEqual({
      learning: 2,
      review: 2,
      new: 2,
      total: 6,
    })
  })

  it('limits new cards per day, across subjects', () => {
    const started = card(
      { state: 'learning', due: at('2026-10-11T00:00:00Z') },
      { introducedOn: '2026-10-10' },
    )
    const fresh = [
      card({}, { subjectId: 'maths' }),
      card({}, { subjectId: 'maths' }),
    ]
    expect(newLeft([started, ...fresh], options)).toBe(1)
    expect(
      buildQueue([started, ...fresh], { ...options, subjectId: 'maths' }),
    ).toHaveLength(1)
    expect(
      dueCounts([started, ...fresh], { ...options, subjectId: null }).new,
    ).toBe(0)
  })

  it('says when the next card is due', () => {
    const soon = card({
      state: 'learning',
      due: at('2026-10-10T09:30:00+11:00'),
    })
    const later = card({
      state: 'review',
      due: at('2026-10-12T09:00:00+11:00'),
    })
    expect(nextDue([later, soon, card({})], { now: NOW })).toEqual(
      new Date(soon.schedule.due),
    )
    expect(nextDue([card({})], { now: NOW })).toBeNull()
    expect(endOfDay(NOW).getHours()).toBe(23)
  })
})

describe('intervals', () => {
  it('read shortly', () => {
    expect(describeInterval(30_000)).toBe('1 min')
    expect(describeInterval(10 * 60_000)).toBe('10 min')
    expect(describeInterval(5 * 3_600_000)).toBe('5 h')
    expect(describeInterval(86_400_000)).toBe('1 day')
    expect(describeInterval(12 * 86_400_000)).toBe('12 days')
    expect(describeInterval(46 * 86_400_000)).toBe('1.5 mo')
    expect(describeInterval(730 * 86_400_000)).toBe('2 yr')
  })

  it('say when, from now', () => {
    expect(describeWhen(new Date('2026-10-10T09:10:00+11:00'), NOW)).toBe(
      'in 10 min',
    )
    expect(describeWhen(new Date('2026-10-11T06:00:00+11:00'), NOW)).toBe(
      'tomorrow',
    )
    expect(describeWhen(new Date('2026-10-14T06:00:00+11:00'), NOW)).toBe(
      'in 4 days',
    )
    expect(describeWhen(new Date('2026-10-10T08:00:00+11:00'), NOW)).toBe('now')
  })
})

describe('cards in a note', () => {
  it('are lines with " :: " between question and answer', () => {
    expect(
      cardsInNote(
        [
          '## Gates',
          'What does a NAND gate output? :: 0 only when both inputs are 1',
          '- **Karnaugh map** :: groups ones in powers of two',
          '1. $\\overline{A \\cdot B}$ :: $\\overline{A} + \\overline{B}$',
          'Just a line.',
          '```cpp',
          'std::vector<int> v :: not a card',
          '```',
          '$$',
          'a :: b',
          '$$',
          'Empty :: ',
          'Use `std::vector` for lists.',
        ].join('\n'),
      ),
    ).toEqual([
      {
        front: 'What does a NAND gate output?',
        back: '0 only when both inputs are 1',
      },
      { front: '**Karnaugh map**', back: 'groups ones in powers of two' },
      {
        front: '$\\overline{A \\cdot B}$',
        back: '$\\overline{A} + \\overline{B}$',
      },
    ])
  })
})

describe('suggested cards', () => {
  it('are read from JSON, fenced or not, with words around', () => {
    const reply = [
      'Here are some cards [from the lecture]:',
      '```json',
      JSON.stringify([
        {
          front: 'What is a minterm?',
          back: 'A product term with every variable',
          page: 2,
        },
        { question: 'Gray code?', answer: 'Neighbours differ in one bit' },
        { front: 'What is a minterm?', back: 'Again' },
        { front: 'No answer' },
        'nonsense',
      ]),
      '```',
    ].join('\n')
    expect(parseSuggestedCards(reply)).toEqual([
      {
        front: 'What is a minterm?',
        back: 'A product term with every variable',
        page: 2,
      },
      { front: 'Gray code?', back: 'Neighbours differ in one bit' },
    ])
    expect(parseSuggestedCards('Sorry, I can’t help with that.')).toEqual([])
    expect(parseSuggestedCards('[not json')).toEqual([])
  })
})
