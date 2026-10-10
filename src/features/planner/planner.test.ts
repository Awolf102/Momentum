import { describe, expect, it } from 'vitest'
import { parseBlock } from './blocks'
import { parseCalendar } from './calendars'
import { eventsOnDay } from './lib/day'
import {
  IcsError,
  parseDateValue,
  parseDuration,
  parseIcs,
  parseLine,
  parseRule,
  unescapeText,
  unfold,
} from './lib/ics'
import { layoutDay } from './lib/layout'
import { occurrenceDays } from './lib/recurrence'
import {
  formatClock,
  formatLength,
  freeSlot,
  parseClock,
  snap,
} from './lib/time'
import { resolveZone, zonedMoment, zoneOffset } from './lib/zones'
import type { Calendar, CalendarEvent, RecurrenceRule } from './types'

// Tests run in Australia/Sydney: daylight saving starts on 4 October 2026.

const TIMETABLE = [
  'BEGIN:VCALENDAR',
  'VERSION:2.0',
  'PRODID:-//Test//Timetable//EN',
  'X-WR-CALNAME:Semester 2 timetable',
  'BEGIN:VTIMEZONE',
  'TZID:Australia/Sydney',
  'BEGIN:STANDARD',
  'DTSTART:19700405T030000',
  'TZOFFSETFROM:+1100',
  'TZOFFSETTO:+1000',
  'END:STANDARD',
  'END:VTIMEZONE',
  'BEGIN:VEVENT',
  'UID:lecture@test',
  'SUMMARY:ELEC2141 Lecture\\, Digital Circuit',
  '  Design',
  'LOCATION:Ainsworth G03',
  'DTSTART;TZID=Australia/Sydney:20260921T090000',
  'DTEND;TZID=Australia/Sydney:20260921T110000',
  'RRULE:FREQ=WEEKLY;BYDAY=MO,WE;UNTIL=20261118T220000Z',
  'EXDATE;TZID=Australia/Sydney:20260928T090000,20260930T090000',
  'BEGIN:VALARM',
  'ACTION:DISPLAY',
  'DESCRIPTION:Reminder',
  'SUMMARY:Not the title',
  'TRIGGER:-PT15M',
  'END:VALARM',
  'END:VEVENT',
  'BEGIN:VEVENT',
  'UID:lecture@test',
  'RECURRENCE-ID;TZID=Australia/Sydney:20261014T090000',
  'SUMMARY:ELEC2141 Lecture (moved)',
  'DTSTART;TZID=Australia/Sydney:20261015T140000',
  'DTEND;TZID=Australia/Sydney:20261015T160000',
  'END:VEVENT',
  'BEGIN:VEVENT',
  'UID:lecture@test',
  'RECURRENCE-ID;TZID=Australia/Sydney:20261019T090000',
  'STATUS:CANCELLED',
  'DTSTART;TZID=Australia/Sydney:20261019T090000',
  'END:VEVENT',
  'BEGIN:VEVENT',
  'UID:exams@test',
  'SUMMARY:Exam period',
  'DTSTART;VALUE=DATE:20261123',
  'DTEND;VALUE=DATE:20261126',
  'END:VEVENT',
  'BEGIN:VEVENT',
  'UID:lab@test',
  'SUMMARY:Lab',
  'DTSTART;TZID="AUS Eastern Standard Time":20261013T140000',
  'DURATION:PT3H',
  'END:VEVENT',
  'BEGIN:VEVENT',
  'UID:broken@test',
  'SUMMARY:No start',
  'END:VEVENT',
  'BEGIN:VEVENT',
  'UID:gone@test',
  'SUMMARY:Cancelled tutorial',
  'STATUS:CANCELLED',
  'DTSTART:20261012T030000Z',
  'DTEND:20261012T040000Z',
  'END:VEVENT',
  'BEGIN:VEVENT',
  'UID:night@test',
  'SUMMARY:Observatory night',
  'DTSTART:20261016T110000Z',
  'DTEND:20261016T150000Z',
  'END:VEVENT',
  'BEGIN:VEVENT',
  'UID:hourly@test',
  'SUMMARY:Every hour',
  'DTSTART:20261012T000000Z',
  'DURATION:PT10M',
  'RRULE:FREQ=HOURLY',
  'END:VEVENT',
  'END:VCALENDAR',
].join('\r\n')

const sydney = (date: string, minutes: number) =>
  zonedMoment(date, minutes, 'Australia/Sydney')

function calendarOf(events: CalendarEvent[], hidden = false): Calendar {
  return {
    id: 'cal',
    name: 'Test',
    color: 'sky',
    hidden,
    fileName: 'test.ics',
    importedAt: '2026-10-10T00:00:00.000Z',
    events,
    createdAt: '2026-10-10T00:00:00.000Z',
    updatedAt: '2026-10-10T00:00:00.000Z',
  }
}

const rule = (parts: Partial<RecurrenceRule>): RecurrenceRule => ({
  frequency: 'weekly',
  interval: 1,
  count: null,
  until: null,
  byDay: [],
  byMonthDay: [],
  byMonth: [],
  weekStart: 1,
  ...parts,
})

const allDay = (date: string, parts: Partial<RecurrenceRule> | null) =>
  ({
    uid: 'x',
    title: 'X',
    location: '',
    start: { date, minutes: null, zone: null },
    length: 1,
    rule: parts ? rule(parts) : null,
    except: [],
  }) satisfies CalendarEvent

const days = (event: CalendarEvent, last: string) => [
  ...occurrenceDays(event, last),
]

describe('time zones', () => {
  it('are read from IANA names, Windows names and vendor prefixes', () => {
    expect(resolveZone('Australia/Sydney')).toBe('Australia/Sydney')
    expect(resolveZone('AUS Eastern Standard Time')).toBe('Australia/Sydney')
    expect(resolveZone('"Europe/London"')).toBe('Europe/London')
    expect(resolveZone('/mozilla.org/20070129_1/Europe/Berlin')).toBe(
      'Europe/Berlin',
    )
    expect(resolveZone('GMT')).toBe('UTC')
    expect(resolveZone('Somewhere Standard Time')).toBeNull()
    expect(resolveZone(undefined)).toBeNull()
  })

  it('give wall-clock times their moment, through daylight saving', () => {
    expect(zoneOffset(Date.UTC(2026, 0, 1), 'Australia/Sydney')).toBe(660)
    expect(zoneOffset(Date.UTC(2026, 6, 1), 'Australia/Sydney')).toBe(600)
    expect(zoneOffset(Date.UTC(2026, 0, 1), 'America/New_York')).toBe(-300)
    expect(sydney('2026-10-10', 540)).toBe(Date.UTC(2026, 9, 9, 22))
    expect(sydney('2026-09-21', 540)).toBe(Date.UTC(2026, 8, 20, 23))
    // 2:30 doesn't happen the night the clocks go forward: it's 3:30.
    expect(sydney('2026-10-04', 150)).toBe(Date.UTC(2026, 9, 3, 16, 30))
    // It happens twice when they go back; either reading is 2:30.
    const twice = sydney('2026-04-05', 150)
    expect(twice + zoneOffset(twice, 'Australia/Sydney') * 60_000).toBe(
      Date.UTC(2026, 3, 5, 2, 30),
    )
    expect(zonedMoment('2026-10-10', 540, 'UTC')).toBe(Date.UTC(2026, 9, 10, 9))
    expect(zonedMoment('2026-10-10', 540, null)).toBe(
      new Date(2026, 9, 10, 9).getTime(),
    )
  })
})

describe('reading .ics lines', () => {
  it('joins folded lines and reads quoted parameters', () => {
    expect(unfold('SUMMARY:Long\r\n  title\r\nUID:1\r\n')).toEqual([
      'SUMMARY:Long title',
      'UID:1',
    ])
    expect(parseLine('DTSTART;TZID="Zone: with; odd":20261010T090000')).toEqual(
      {
        name: 'DTSTART',
        params: { TZID: 'Zone: with; odd' },
        value: '20261010T090000',
      },
    )
    expect(parseLine('no colon here')).toBeNull()
    expect(unescapeText('a\\, b\\; c\\nd\\\\e')).toBe('a, b; c\nd\\e')
  })

  it('reads days, times and lengths', () => {
    expect(parseDateValue('20261010')).toEqual({
      date: '2026-10-10',
      minutes: null,
      zone: null,
    })
    expect(parseDateValue('20261010T093000Z')).toEqual({
      date: '2026-10-10',
      minutes: 570,
      zone: 'UTC',
    })
    expect(
      parseDateValue('20261010T093000', { TZID: 'Australia/Sydney' }),
    ).toEqual({ date: '2026-10-10', minutes: 570, zone: 'Australia/Sydney' })
    expect(parseDateValue('20261010T093000')?.zone).toBeNull()
    expect(parseDateValue('20260231')).toBeNull()
    expect(parseDateValue('20261010T250000')).toBeNull()
    expect(parseDuration('PT1H30M')).toBe(90)
    expect(parseDuration('P1D')).toBe(1440)
    expect(parseDuration('P1W')).toBe(10080)
    expect(parseDuration('-PT15M')).toBe(-15)
    expect(parseDuration('P')).toBeNull()
    expect(parseDuration('PT')).toBeNull()
  })

  it('reads how events repeat, or says when it can’t follow', () => {
    const start = { date: '2026-09-21', minutes: 540, zone: 'Australia/Sydney' }
    expect(
      parseRule('FREQ=WEEKLY;BYDAY=MO,WE;UNTIL=20261118T220000Z', start),
    ).toMatchObject({
      frequency: 'weekly',
      byDay: [
        { weekday: 1, ordinal: null },
        { weekday: 3, ordinal: null },
      ],
      until: Date.UTC(2026, 10, 18, 22),
    })
    expect(parseRule('FREQ=MONTHLY;BYDAY=-1FR;COUNT=3', start)).toMatchObject({
      frequency: 'monthly',
      byDay: [{ weekday: 5, ordinal: -1 }],
      count: 3,
    })
    expect(parseRule('FREQ=HOURLY', start)).toBe('unsupported')
    expect(parseRule('FREQ=MONTHLY;BYDAY=MO;BYSETPOS=-1', start)).toBe(
      'unsupported',
    )
    expect(parseRule('FREQ=WEEKLY;INTERVAL=0', start)).toBeNull()
    expect(parseRule('INTERVAL=2', start)).toBeNull()
    // A day as the end of a timed series: anything starting that day.
    expect(parseRule('FREQ=DAILY;UNTIL=20261012', start)).toMatchObject({
      until: sydney('2026-10-13', 0) - 1,
    })
  })
})

describe('an imported timetable', () => {
  const parsed = parseIcs(TIMETABLE)
  const calendar = calendarOf(parsed.events)
  const on = (day: string) =>
    eventsOnDay([calendar], day).map((event) => ({
      title: event.title,
      start: event.start,
      end: event.end,
      allDay: event.allDay,
      fromBefore: event.fromBefore,
      pastEnd: event.pastEnd,
    }))

  it('keeps what can be shown, and counts what can’t', () => {
    expect(parsed.name).toBe('Semester 2 timetable')
    expect(parsed.events.map((event) => event.title)).toEqual([
      'ELEC2141 Lecture, Digital Circuit Design',
      'ELEC2141 Lecture (moved)',
      'Exam period',
      'Lab',
      'Observatory night',
      'Every hour',
    ])
    expect(parsed.events[0].location).toBe('Ainsworth G03')
    expect(parsed).toMatchObject({
      repeating: 1,
      unsupported: 1,
      cancelled: 2,
      skipped: 1,
    })
    // The break, the moved lecture and the cancelled one are left out of the series.
    expect(parsed.events[0].except).toEqual([
      sydney('2026-09-28', 540),
      sydney('2026-09-30', 540),
      sydney('2026-10-14', 540),
      sydney('2026-10-19', 540),
    ])
    expect(parsed.events[3].start.zone).toBe('Australia/Sydney')
    expect(parsed.events[3].length).toBe(180)
  })

  it('puts each time on its day, at the same time of day through daylight saving', () => {
    const lecture = {
      title: 'ELEC2141 Lecture, Digital Circuit Design',
      start: 540,
      end: 660,
      allDay: false,
      fromBefore: false,
      pastEnd: false,
    }
    expect(on('2026-09-21')).toEqual([lecture])
    expect(on('2026-09-28')).toEqual([])
    expect(on('2026-10-05')).toEqual([lecture])
    expect(on('2026-11-18')).toEqual([lecture])
    expect(on('2026-11-23').map((event) => event.title)).toEqual([
      'Exam period',
    ])
  })

  it('moves and cancels single times of a series', () => {
    expect(on('2026-10-14')).toEqual([])
    expect(on('2026-10-15')).toEqual([
      {
        title: 'ELEC2141 Lecture (moved)',
        start: 840,
        end: 960,
        allDay: false,
        fromBefore: false,
        pastEnd: false,
      },
    ])
    expect(on('2026-10-19')).toEqual([])
  })

  it('shows all-day and overnight events on every day they touch', () => {
    expect(on('2026-11-23')[0]).toMatchObject({
      allDay: true,
      fromBefore: false,
      pastEnd: true,
    })
    expect(on('2026-11-25')[0]).toMatchObject({
      allDay: true,
      fromBefore: true,
      pastEnd: false,
    })
    expect(on('2026-11-26')).toEqual([])
    // 11:00–15:00 UTC is 22:00–2:00 in Sydney.
    expect(on('2026-10-16')).toContainEqual({
      title: 'Observatory night',
      start: 1320,
      end: 1440,
      allDay: false,
      fromBefore: false,
      pastEnd: true,
    })
    expect(on('2026-10-17')).toEqual([
      {
        title: 'Observatory night',
        start: 0,
        end: 120,
        allDay: false,
        fromBefore: true,
        pastEnd: false,
      },
    ])
    expect(
      on('2026-10-13').map((event) => [event.title, event.start, event.end]),
    ).toEqual([['Lab', 840, 1020]])
    // A rule it can't follow: shown the first time only.
    expect(on('2026-10-12').map((event) => event.title)).toContain('Every hour')
    expect(on('2026-10-13').map((event) => event.title)).not.toContain(
      'Every hour',
    )
    expect(
      eventsOnDay([calendarOf(parsed.events, true)], '2026-10-13'),
    ).toEqual([])
  })

  it('refuses a file that isn’t a calendar', () => {
    expect(() => parseIcs('name,date\nLab,2026-10-10')).toThrow(IcsError)
  })
})

describe('repeating events', () => {
  it('fall on the nth or last weekday of the month', () => {
    expect(
      days(
        allDay('2026-10-13', {
          frequency: 'monthly',
          byDay: [{ weekday: 2, ordinal: 2 }],
        }),
        '2026-12-31',
      ),
    ).toEqual(['2026-10-13', '2026-11-10', '2026-12-08'])
    expect(
      days(
        allDay('2026-10-30', {
          frequency: 'monthly',
          byDay: [{ weekday: 5, ordinal: -1 }],
        }),
        '2026-12-31',
      ),
    ).toEqual(['2026-10-30', '2026-11-27', '2026-12-25'])
  })

  it('skip months without the day, and years without 29 February', () => {
    expect(
      days(allDay('2026-10-31', { frequency: 'monthly' }), '2027-01-31'),
    ).toEqual(['2026-10-31', '2026-12-31', '2027-01-31'])
    expect(
      days(allDay('2024-02-29', { frequency: 'yearly' }), '2028-12-31'),
    ).toEqual(['2024-02-29', '2028-02-29'])
  })

  it('follow intervals, weekdays and the week’s first day', () => {
    expect(
      days(
        allDay('2026-10-13', {
          interval: 2,
          byDay: [
            { weekday: 2, ordinal: null },
            { weekday: 4, ordinal: null },
          ],
          weekStart: 0,
        }),
        '2026-11-12',
      ),
    ).toEqual([
      '2026-10-13',
      '2026-10-15',
      '2026-10-27',
      '2026-10-29',
      '2026-11-10',
      '2026-11-12',
    ])
  })

  it('stop after a count (left-out times included) or on their last day', () => {
    const event = {
      ...allDay('2026-10-10', { frequency: 'daily', count: 3 }),
      except: ['2026-10-11'],
    }
    expect(days(event, '2026-12-31')).toEqual([
      '2026-10-10',
      '2026-10-11',
      '2026-10-12',
    ])
    expect(
      eventsOnDay([calendarOf([event])], '2026-10-11').map(
        (each) => each.title,
      ),
    ).toEqual([])
    expect(
      days(
        allDay('2026-10-10', { frequency: 'daily', until: '2026-10-12' }),
        '2026-12-31',
      ),
    ).toEqual(['2026-10-10', '2026-10-11', '2026-10-12'])
  })
})

describe('the day’s layout', () => {
  it('puts overlapping items side by side, and the rest full width', () => {
    const placed = layoutDay([
      { id: 'a', start: 540, end: 600 },
      { id: 'b', start: 570, end: 630 },
      { id: 'c', start: 600, end: 660 },
      { id: 'd', start: 700, end: 720 },
    ])
    expect(
      placed.map(({ item, column, columns }) => [item.id, column, columns]),
    ).toEqual([
      ['a', 0, 2],
      ['b', 1, 2],
      ['c', 0, 2],
      ['d', 0, 1],
    ])
  })

  it('gives a very short item the room it takes on screen', () => {
    const placed = layoutDay([
      { id: 'due', start: 540, end: 540 },
      { id: 'next', start: 545, end: 560 },
    ])
    expect(placed.map(({ column, columns }) => [column, columns])).toEqual([
      [0, 2],
      [1, 2],
    ])
  })
})

describe('times on the plan', () => {
  it('snap to quarter hours and read as clock times', () => {
    expect(snap(52)).toBe(45)
    expect(snap(53)).toBe(60)
    expect(snap(46, 15, true)).toBe(60)
    expect(snap(-20)).toBe(0)
    expect(formatClock(570, 'en-US')).toBe('9:30 AM')
    expect(formatClock(1440, 'en-US')).toBe('12:00 AM')
    expect(formatLength(45)).toBe('45 min')
    expect(formatLength(60)).toBe('1 h')
    expect(formatLength(90)).toBe('1 h 30 min')
    expect(parseClock('09:30')).toBe(570)
    expect(parseClock('24:00')).toBeNull()
  })

  it('find the next free time that fits', () => {
    const taken = [
      { start: 540, end: 600 },
      { start: 600, end: 660 },
    ]
    expect(freeSlot(taken, 530, 30)).toBe(660)
    expect(freeSlot(taken, 480, 30)).toBe(480)
    expect(freeSlot(taken, 500, 60)).toBe(660)
    expect(freeSlot([], 1430, 30)).toBeNull()
  })
})

describe('stored plans and calendars', () => {
  const stamps = {
    createdAt: '2026-10-10T00:00:00.000Z',
    updatedAt: '2026-10-10T00:00:00.000Z',
  }

  it('keep blocks within the day, at least a quarter hour long', () => {
    expect(
      parseBlock({
        ...stamps,
        id: 'b',
        day: '2026-10-10',
        start: 1430,
        end: 1500,
        kind: 'focus',
        title: 'Revise',
        taskId: null,
        subjectId: 'calculus',
      }),
    ).toMatchObject({ start: 1425, end: 1440, kind: 'focus' })
    expect(
      parseBlock({
        ...stamps,
        id: 'b',
        day: '2026-10-10',
        start: 600,
        end: 590,
        kind: 'task',
        taskId: null,
      }),
    ).toMatchObject({ start: 600, end: 615, kind: 'other', taskId: null })
    expect(
      parseBlock({ ...stamps, id: 'b', day: 'today', start: 1, end: 2 }),
    ).toBeNull()
  })

  it('keep calendars’ readable events and drop the rest', () => {
    const parsed = parseIcs(TIMETABLE)
    const stored = parseCalendar(
      JSON.parse(
        JSON.stringify({
          ...stamps,
          id: 'c',
          name: '',
          color: 'chartreuse',
          events: [...parsed.events, { start: 'soon' }],
        }),
      ),
    )
    expect(stored).toMatchObject({
      name: 'Calendar',
      color: 'sky',
      hidden: false,
    })
    expect(stored?.events).toEqual(parsed.events)
  })
})
