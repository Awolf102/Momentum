import { describe, expect, it } from 'vitest'
import { parseQuickAdd, type QuickAddOptions } from './quickAdd'

// Saturday 10 October 2026, in Australia (12/10 is 12 October).
const options: QuickAddOptions = {
  today: '2026-10-10',
  dayFirst: true,
  subjects: [
    { id: 'calculus', name: 'Calculus' },
    { id: 'digital-logic', name: 'Digital Logic' },
    { id: 'reading', name: 'Reading' },
  ],
}
const parse = (input: string, extra: Partial<QuickAddOptions> = {}) =>
  parseQuickAdd(input, { ...options, ...extra })

describe('quick add', () => {
  it('reads a whole task from one line', () => {
    const task = parse('Read chapter 4 tomorrow 5pm #reading !high')
    expect(task).toMatchObject({
      title: 'Read chapter 4',
      due: '2026-10-11',
      time: '17:00',
      subjectId: 'reading',
      priority: 3,
      recurrence: null,
    })
    expect(task.matched.map((part) => part.text)).toEqual([
      'tomorrow',
      '5pm',
      '#reading',
      '!high',
    ])
  })

  it('leaves a plain title alone', () => {
    expect(parse('Email the tutor about the lab')).toMatchObject({
      title: 'Email the tutor about the lab',
      due: null,
      time: null,
      subjectId: null,
      priority: 0,
    })
  })

  it('understands relative days', () => {
    expect(parse('Revise today').due).toBe('2026-10-10')
    expect(parse('Revise tonight').due).toBe('2026-10-10')
    expect(parse('Revise in 3 days').due).toBe('2026-10-13')
    expect(parse('Revise in a week').due).toBe('2026-10-17')
    expect(parse('Revise in 2 months').due).toBe('2026-12-10')
    expect(parse('Revise next week').due).toBe('2026-10-12')
    expect(parse('Revise next month').due).toBe('2026-11-01')
    expect(parse('Revise this weekend').due).toBe('2026-10-10')
  })

  it('understands weekdays', () => {
    expect(parse('Lab report friday').due).toBe('2026-10-16')
    expect(parse('Lab report by fri').due).toBe('2026-10-16')
    expect(parse('Lab report monday').due).toBe('2026-10-12')
    // "next friday" is the Friday of next week: on a Saturday, the coming one;
    // on a Monday, a week and a half away.
    expect(parse('Lab report next friday').due).toBe('2026-10-16')
    expect(parse('Lab report friday', { today: '2026-10-12' }).due).toBe(
      '2026-10-16',
    )
    expect(parse('Lab report next friday', { today: '2026-10-12' }).due).toBe(
      '2026-10-23',
    )
    // Today is Saturday: "on saturday" is today, and "next sat" next week's.
    expect(parse('Lab report on saturday').due).toBe('2026-10-10')
    expect(parse('Lab report next sat').due).toBe('2026-10-17')
  })

  it("doesn't mistake words for days", () => {
    expect(parse('SAT practice test')).toMatchObject({
      title: 'SAT practice test',
      due: null,
    })
    expect(parse('Buy sun cream').due).toBeNull()
    expect(parse('Plan the month').due).toBeNull()
    expect(parse('Call Tom').title).toBe('Call Tom')
  })

  it('understands dates, rolling into next year once passed', () => {
    expect(parse('Exam 12 oct').due).toBe('2026-10-12')
    expect(parse('Exam Oct 12th').due).toBe('2026-10-12')
    expect(parse('Exam on 3 March').due).toBe('2027-03-03')
    expect(parse('Exam 2026-11-02').due).toBe('2026-11-02')
    expect(parse('Exam 12/11').due).toBe('2026-11-12')
    expect(parse('Exam 12/11', { dayFirst: false }).due).toBe('2026-12-11')
    expect(parse('Exam 31/2').due).toBeNull()
  })

  it('reads times, and a time alone means today', () => {
    expect(parse('Call at 9:30am')).toMatchObject({
      due: '2026-10-10',
      time: '09:30',
    })
    expect(parse('Call 17:45 tomorrow').time).toBe('17:45')
    expect(parse('Lunch noon').time).toBe('12:00')
    expect(parse('Call 12am').time).toBe('00:00')
  })

  it('finds subjects by name, ignoring case and spaces', () => {
    expect(parse('Truth tables #digital-logic').subjectId).toBe('digital-logic')
    expect(parse('Truth tables #DigitalLogic').subjectId).toBe('digital-logic')
    expect(parse('Integrals #calc').subjectId).toBe('calculus')
    // Unknown tags stay in the title.
    expect(parse('Shopping #home')).toMatchObject({
      title: 'Shopping #home',
      subjectId: null,
    })
  })

  it('reads priorities', () => {
    expect(parse('Pay rent !!!').priority).toBe(3)
    expect(parse('Pay rent !!').priority).toBe(2)
    expect(parse('Pay rent !low').priority).toBe(1)
    // Punctuation in the title isn't a priority.
    expect(parse('Call mum!')).toMatchObject({
      title: 'Call mum!',
      priority: 0,
    })
  })

  it('reads repeats and starts them on their first date', () => {
    expect(parse('Gym every monday and thursday')).toMatchObject({
      title: 'Gym',
      due: '2026-10-12',
      recurrence: {
        unit: 'week',
        interval: 1,
        weekdays: [1, 4],
        anchor: '2026-10-12',
      },
    })
    expect(parse('Water plants every day').recurrence).toMatchObject({
      unit: 'day',
      interval: 1,
    })
    expect(parse('Water plants every day').due).toBe('2026-10-10')
    expect(parse('Review notes every weekday').recurrence?.weekdays).toEqual([
      1, 2, 3, 4, 5,
    ])
    expect(parse('Rent monthly').recurrence?.unit).toBe('month')
    expect(parse('Bins fortnightly').recurrence).toMatchObject({
      unit: 'week',
      interval: 2,
    })
    expect(parse('Backup every 3 months starting 1 nov')).toMatchObject({
      title: 'Backup starting',
      due: '2026-11-01',
      recurrence: { unit: 'month', interval: 3, anchor: '2026-11-01' },
    })
    expect(parse('Tutorial every other week on wed')).toMatchObject({
      due: '2026-10-14',
      recurrence: { unit: 'week', interval: 2, weekdays: [3] },
    })
  })

  it('keeps quoted text as it is', () => {
    expect(parse('Read "Tomorrow and Tomorrow" by friday')).toMatchObject({
      title: 'Read Tomorrow and Tomorrow',
      due: '2026-10-16',
    })
  })

  it("keeps the input as the title when there's nothing else", () => {
    expect(parse('tomorrow')).toMatchObject({ title: 'tomorrow', due: null })
  })
})
