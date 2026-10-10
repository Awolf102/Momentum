import {
  addDays,
  addMonths,
  dayOfWeek,
  makeDateKey,
  startOfWeek,
  type DateKey,
  type Weekday,
} from '@/lib/date'
import type { Priority, Recurrence, RecurrenceUnit } from '../types'
import { firstOnOrAfter } from './recurrence'

export type QuickAddPart = 'date' | 'time' | 'subject' | 'priority' | 'repeat'

export interface QuickAddResult {
  title: string
  due: DateKey | null
  time: string | null
  subjectId: string | null
  priority: Priority
  recurrence: Recurrence | null
  /** What was recognised, as typed, in the order it appeared. */
  matched: { part: QuickAddPart; text: string }[]
}

export interface QuickAddOptions {
  today: DateKey
  subjects: readonly { id: string; name: string }[]
  /** Whether 12/10 is 12 October (true, as in Australia) or December 10. */
  dayFirst: boolean
}

// Weekday names. Full names, and abbreviations that aren't everyday words,
// count anywhere; "sat", "sun" and "wed" only after on / by / next / every,
// so "SAT practice" stays a title.
const DAY_FORMS: [Weekday, string, boolean][] = [
  [0, 'sun(?:day)?', false],
  [1, 'mon(?:day)?', true],
  [2, 'tue(?:s(?:day)?)?', true],
  [3, 'wed(?:nesday)?', false],
  [4, 'thu(?:r(?:s(?:day)?)?)?', true],
  [5, 'fri(?:day)?', true],
  [6, 'sat(?:urday)?', false],
]
const ANY_DAY = `(?:${DAY_FORMS.map(([, form]) => form).join('|')})`
const SAFE_DAY = `(?:sunday|wednesday|saturday|${DAY_FORMS.filter(
  ([, , safe]) => safe,
)
  .map(([, form]) => form)
  .join('|')})`
const DAY_LIST = `${ANY_DAY}(?:\\s*(?:,|and|&)?\\s*${ANY_DAY})*`

const MONTHS = [
  'jan(?:uary)?',
  'feb(?:ruary)?',
  'mar(?:ch)?',
  'apr(?:il)?',
  'may',
  'june?',
  'july?',
  'aug(?:ust)?',
  'sep(?:t(?:ember)?)?',
  'oct(?:ober)?',
  'nov(?:ember)?',
  'dec(?:ember)?',
]
const MONTH = `(?:${MONTHS.join('|')})`
const ORDINAL = '(?:st|nd|rd|th)?'
const ON = '(?:(?:on|due|by)\\s+)?'

const NUMBER_WORDS: Record<string, number> = {
  a: 1,
  an: 1,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
}

function weekdayOf(word: string): Weekday {
  const found = DAY_FORMS.find(([, form]) =>
    new RegExp(`^${form}$`, 'i').test(word),
  )
  return found ? found[0] : 1
}

function monthOf(word: string): number {
  return MONTHS.findIndex((form) => new RegExp(`^${form}$`, 'i').test(word)) + 1
}

function weekdaysIn(list: string): Weekday[] {
  const days = list.match(new RegExp(ANY_DAY, 'gi')) ?? []
  return [...new Set(days.map(weekdayOf))].sort() as Weekday[]
}

const unitOf = (word: string) =>
  word.toLowerCase().replace(/s$/, '') as RecurrenceUnit

/** The next `weekday` on or after `today` (or after it, with `skipToday`). */
function upcoming(today: DateKey, weekday: Weekday, skipToday = false) {
  const ahead = (weekday - dayOfWeek(today) + 7) % 7
  return addDays(today, ahead === 0 && skipToday ? 7 : ahead)
}

/**
 * Finds the first match of `core` as whole words, removes it from the text and
 * returns its groups. Patterns are tried in order; the text shrinks as parts
 * are recognised.
 */
class Scanner {
  text: string
  readonly matched: { part: QuickAddPart; text: string; at: number }[] = []
  constructor(text: string) {
    this.text = ` ${text} `
  }
  take(part: QuickAddPart, core: string): RegExpExecArray | null {
    const pattern = new RegExp(`(\\s)(${core})(?=\\s)`, 'i')
    const match = pattern.exec(this.text)
    if (!match) return null
    const start = match.index + match[1].length
    const end = start + match[2].length
    this.matched.push({ part, text: match[2], at: start })
    // Blanked rather than cut, so positions of what's found later still line up.
    this.text = `${this.text.slice(0, start)}${' '.repeat(end - start)}${this.text.slice(end)}`
    // Groups inside `core` start at index 3.
    return match.slice(2) as unknown as RegExpExecArray
  }
}

function parseRepeat(scan: Scanner): Omit<Recurrence, 'anchor'> | null {
  let m = scan.take(
    'repeat',
    `every\\s+(other|\\d+)\\s+weeks?\\s+on\\s+(${DAY_LIST})`,
  )
  if (m) {
    return {
      unit: 'week',
      interval: m[1].toLowerCase() === 'other' ? 2 : Math.max(1, Number(m[1])),
      weekdays: weekdaysIn(m[2]),
    }
  }
  if ((m = scan.take('repeat', 'every\\s+(?:weekday|workday)s?')))
    return { unit: 'week', interval: 1, weekdays: [1, 2, 3, 4, 5] }
  if ((m = scan.take('repeat', 'every\\s+weekends?')))
    return { unit: 'week', interval: 1, weekdays: [0, 6] }
  if ((m = scan.take('repeat', `every\\s+(${DAY_LIST})`)))
    return { unit: 'week', interval: 1, weekdays: weekdaysIn(m[1]) }
  if ((m = scan.take('repeat', 'every\\s+(other\\s+)?(day|week|month|year)')))
    return { unit: unitOf(m[2]), interval: m[1] ? 2 : 1, weekdays: [] }
  if (
    (m = scan.take(
      'repeat',
      'every\\s+(\\d+)\\s+(days?|weeks?|months?|years?)',
    ))
  )
    return {
      unit: unitOf(m[2]),
      interval: Math.max(1, Number(m[1])),
      weekdays: [],
    }
  if (
    (m = scan.take(
      'repeat',
      'daily|weekly|fortnightly|monthly|yearly|annually',
    ))
  ) {
    const word = m[0].toLowerCase()
    if (word === 'fortnightly')
      return { unit: 'week', interval: 2, weekdays: [] }
    const unit: RecurrenceUnit =
      word === 'daily'
        ? 'day'
        : word === 'weekly'
          ? 'week'
          : word === 'monthly'
            ? 'month'
            : 'year'
    return { unit, interval: 1, weekdays: [] }
  }
  return null
}

function parseDate(
  scan: Scanner,
  { today, dayFirst }: QuickAddOptions,
): DateKey | null {
  let m = scan.take('date', `${ON}(today|tod|tonight)`)
  if (m) return today
  if ((m = scan.take('date', `${ON}(tomorrow|tmrw|tmr)`)))
    return addDays(today, 1)
  if ((m = scan.take('date', `${ON}next\\s+week`)))
    return addDays(startOfWeek(today, 1), 7)
  if ((m = scan.take('date', `${ON}next\\s+month`))) {
    const next = addMonths(today, 1)
    return `${next.slice(0, 8)}01`
  }
  if ((m = scan.take('date', `${ON}(?:this\\s+)?weekend`)))
    return upcoming(today, 6)
  if (
    (m = scan.take(
      'date',
      `in\\s+(\\d+|a|an|one|two|three|four|five|six)\\s+(days?|weeks?|months?)`,
    ))
  ) {
    const amount = NUMBER_WORDS[m[1].toLowerCase()] ?? Number(m[1])
    const unit = unitOf(m[2])
    return unit === 'month'
      ? addMonths(today, amount)
      : addDays(today, unit === 'week' ? amount * 7 : amount)
  }
  // "next friday": the Friday of next week; "on sat", "by wed": the coming one.
  if ((m = scan.take('date', `next\\s+(${ANY_DAY})`))) {
    return addDays(startOfWeek(today, 1), 7 + ((weekdayOf(m[1]) + 6) % 7))
  }
  if ((m = scan.take('date', `(?:on|due|by)\\s+(${ANY_DAY})`)))
    return upcoming(today, weekdayOf(m[1]))
  if ((m = scan.take('date', `(${SAFE_DAY})`)))
    return upcoming(today, weekdayOf(m[1]))
  // Dates in the year: ISO, "12 Oct", "Oct 12", "12/10".
  const year = Number(today.slice(0, 4))
  const inFuture = (month: number, day: number, givenYear?: string) => {
    if (givenYear) {
      const y = Number(givenYear.length === 2 ? `20${givenYear}` : givenYear)
      return makeDateKey(y, month, day)
    }
    const thisYear = makeDateKey(year, month, day)
    // A date that has passed this year means next year's.
    return thisYear && thisYear < today
      ? makeDateKey(year + 1, month, day)
      : thisYear
  }
  if ((m = scan.take('date', `${ON}(\\d{4})-(\\d{2})-(\\d{2})`)))
    return makeDateKey(Number(m[1]), Number(m[2]), Number(m[3]))
  if (
    (m = scan.take(
      'date',
      `${ON}(\\d{1,2})${ORDINAL}\\s+(${MONTH})(?:\\s+(\\d{4}))?`,
    ))
  )
    return inFuture(monthOf(m[2]), Number(m[1]), m[3])
  if (
    (m = scan.take(
      'date',
      `${ON}(${MONTH})\\s+(\\d{1,2})${ORDINAL}(?:,?\\s+(\\d{4}))?`,
    ))
  )
    return inFuture(monthOf(m[1]), Number(m[2]), m[3])
  if (
    (m = scan.take('date', `${ON}(\\d{1,2})/(\\d{1,2})(?:/(\\d{2}|\\d{4}))?`))
  ) {
    const [a, b] = [Number(m[1]), Number(m[2])]
    return dayFirst ? inFuture(b, a, m[3]) : inFuture(a, b, m[3])
  }
  return null
}

function parseTime(scan: Scanner): string | null {
  const pad = (n: number) => String(n).padStart(2, '0')
  let m = scan.take(
    'time',
    '(?:at\\s+|@)?(\\d{1,2})(?::([0-5]\\d))?\\s?(am|pm)',
  )
  if (m) {
    const hour = Number(m[1])
    if (hour < 1 || hour > 12) return null
    const h24 = (hour % 12) + (m[3].toLowerCase() === 'pm' ? 12 : 0)
    return `${pad(h24)}:${m[2] ?? '00'}`
  }
  if ((m = scan.take('time', '(?:at\\s+|@)?([01]?\\d|2[0-3]):([0-5]\\d)')))
    return `${pad(Number(m[1]))}:${m[2]}`
  if ((m = scan.take('time', '(?:at\\s+)?noon'))) return '12:00'
  return null
}

const normalise = (text: string) =>
  text.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '')

function parseSubject(scan: Scanner, subjects: QuickAddOptions['subjects']) {
  const tags = scan.text.match(/#[\p{L}\p{N}_-]+/gu) ?? []
  for (const tag of tags) {
    const name = normalise(tag.slice(1))
    const subject =
      subjects.find((s) => normalise(s.name) === name) ??
      subjects.find(
        (s) => normalise(s.name).startsWith(name) && name.length >= 3,
      )
    if (subject) {
      scan.take('subject', tag.replace(/[.*+?^${}()|[\]\\-]/g, '\\$&'))
      return subject.id
    }
  }
  return null
}

function parsePriority(scan: Scanner): Priority {
  if (scan.take('priority', '!!!|!high|!h')) return 3
  if (scan.take('priority', '!!|!medium|!med|!m')) return 2
  if (scan.take('priority', '!|!low|!l')) return 1
  return 0
}

/**
 * Reads a task typed in one line: "Read chapter 4 tomorrow 5pm #reading !high
 * every week". What it recognises becomes the due date, time, subject,
 * priority and repeat; the rest is the title. Text in "quotes" is left alone.
 */
export function parseQuickAdd(
  input: string,
  options: QuickAddOptions,
): QuickAddResult {
  // Quoted text is kept out of reach of the patterns.
  const quoted: string[] = []
  const masked = input.replace(/"([^"]*)"/g, (_, inner: string) => {
    quoted.push(inner)
    return `\uE000${quoted.length - 1}\uE000`
  })
  const scan = new Scanner(masked)
  const priority = parsePriority(scan)
  const subjectId = parseSubject(scan, options.subjects)
  const repeat = parseRepeat(scan)
  let due = parseDate(scan, options)
  const time = parseTime(scan)
  const title = scan.text
    .replace(/\uE000(\d+)\uE000/g, (_, index: string) => quoted[Number(index)])
    .replace(/\s+/g, ' ')
    .trim()

  // Nothing but a date and the like isn't a task: keep it all as the title.
  if (!title) {
    return {
      title: input.trim(),
      due: null,
      time: null,
      subjectId: null,
      priority: 0,
      recurrence: null,
      matched: [],
    }
  }

  let recurrence: Recurrence | null = null
  if (repeat) {
    // The first occurrence: on or after the date given (or today), and the
    // schedule counts from there.
    const start = due ?? options.today
    due = firstOnOrAfter(start, { ...repeat, interval: 1, anchor: start })
    recurrence = { ...repeat, anchor: due }
  }
  if (time && !due) due = options.today

  return {
    title,
    due,
    time,
    subjectId,
    priority,
    recurrence,
    matched: scan.matched
      .sort((a, b) => a.at - b.at)
      .map(({ part, text }) => ({ part, text })),
  }
}
