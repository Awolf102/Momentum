import { describe, expect, it } from 'vitest'
import type { ChoiceQuestion, ShortQuestion } from '../types'
import {
  chooseAnswer,
  currentIndex,
  finishAttempt,
  formatPoints,
  markAnswer,
  missedIn,
  newAttempt,
  scoreOf,
  writeAnswer,
} from './attempt'
import { describePages, describeSent, formatPages, parsePages } from './pages'
import { readQuestions, shuffleChoices, type SentSource } from './questions'

const NOW = new Date('2026-10-10T09:00:00+11:00')

describe('pages written as in a print dialog', () => {
  it('reads ranges, single pages and open ends', () => {
    expect(parsePages('', 4)).toEqual([1, 2, 3, 4])
    expect(parsePages(' All ', 3)).toEqual([1, 2, 3])
    expect(parsePages('3-5, 1', 10)).toEqual([1, 3, 4, 5])
    expect(parsePages('2 – 3 7', 10)).toEqual([2, 3, 7])
    expect(parsePages('8 to 9', 10)).toEqual([8, 9])
    expect(parsePages('9-', 10)).toEqual([9, 10])
    expect(parsePages('4,4,4', 10)).toEqual([4])
  })

  it('refuses what it can’t read, or pages past the end', () => {
    expect(parsePages('3-x', 10)).toBeNull()
    expect(parsePages('11', 10)).toBeNull()
    expect(parsePages('5-2', 10)).toBeNull()
    expect(parsePages('0', 10)).toBeNull()
    expect(parsePages(',', 10)).toBeNull()
  })

  it('writes pages back as runs, and in words', () => {
    expect(formatPages([1, 2, 3, 5, 7, 8])).toBe('1–3, 5, 7–8')
    expect(describePages([1, 2, 3], 3)).toBe('All 3 pages')
    expect(describePages([4], 30)).toBe('Page 4')
    expect(describePages([3, 4, 5, 9], 30)).toBe('Pages 3–5, 9')
    expect(describePages([1, 3, 5, 7, 9, 11], 30)).toBe('6 of 30 pages')
    expect(describePages([], 30)).toBe('No pages')
  })

  it('say what of each source is sent', () => {
    const doc = (pages: number[], text = 'x') => ({
      kind: 'document' as const,
      title: 'D',
      parts: pages.map((page) => ({ page, text })),
    })
    const note = (text: string) => ({
      kind: 'note' as const,
      title: 'N',
      parts: [{ page: null, text }],
    })
    expect(describeSent(doc([1, 2, 3]), doc([1, 2, 3]), 3)).toBe('All 3 pages')
    expect(describeSent(doc([3, 4]), doc([3, 4]), 9)).toBe('Pages 3–4')
    expect(describeSent(doc([1, 2, 3, 4]), doc([1, 3]), 4)).toBe(
      '2 of 4 pages, spread out',
    )
    expect(describeSent(doc([5], 'long text'), doc([5], 'long'), 9)).toBe(
      'Page 5 (one shortened to fit)',
    )
    expect(describeSent(note('All of it'), note('All of it'), null)).toBe(
      'The whole note',
    )
    expect(describeSent(note('All of it'), note('All'), null)).toBe(
      'The start of the note',
    )
    expect(describeSent(note('x'), { ...note(''), parts: [] }, null)).toBe(
      'Not sent: no room left',
    )
  })
})

const sent: SentSource[] = [
  { kind: 'document', id: 'lecture', pages: [1, 2, 3] },
  { kind: 'note', id: 'gates', pages: null },
]

describe('reading a quiz from a reply', () => {
  it('reads both kinds, with where each comes from', () => {
    const reply = `Here you go:
\`\`\`json
[
  {"kind": "choice", "question": "Which gate is universal?", "choices": ["XOR", "NAND", "NOT", "Buffer"], "answer": "NAND", "explanation": "Any function can be built from NAND alone.", "source": 1, "page": 2},
  {"kind": "short", "question": "What does a flip-flop store?", "answer": "One bit.", "points": ["one bit", "", "state"], "source": 2, "page": 4}
]
\`\`\``
    const [choice, short] = readQuestions(reply, sent)
    expect(choice).toMatchObject({
      kind: 'choice',
      prompt: 'Which gate is universal?',
      choices: ['XOR', 'NAND', 'NOT', 'Buffer'],
      answer: 1,
      explanation: 'Any function can be built from NAND alone.',
      source: { kind: 'document', id: 'lecture', page: 2 },
    })
    expect(short).toMatchObject({
      kind: 'short',
      answer: 'One bit.',
      points: ['one bit', 'state'],
      // A note has no pages.
      source: { kind: 'note', id: 'gates', page: null },
    })
    expect(choice.id).not.toBe(short.id)
  })

  it('finds the right choice by its text or letter, never a bare number', () => {
    const question = (answer: unknown) =>
      readQuestions(
        JSON.stringify([
          {
            kind: 'choice',
            question: 'Q',
            choices: ['A) Latch', 'B) Flip-flop', 'C) Mux'],
            answer,
          },
        ]),
        sent,
      )[0] as ChoiceQuestion | undefined
    expect(question('flip-flop.')?.answer).toBe(1)
    expect(question('B) Flip-flop')?.answer).toBe(1)
    expect(question('c')?.answer).toBe(2)
    // Labels in order are taken off the choices.
    expect(question('Mux')?.choices).toEqual(['Latch', 'Flip-flop', 'Mux'])
    expect(question(1)).toBeUndefined()
    expect(question('Decoder')).toBeUndefined()
  })

  it('leaves out broken questions, repeats and kinds not asked for', () => {
    const reply = JSON.stringify([
      { kind: 'choice', question: 'One choice', choices: ['A'], answer: 'A' },
      {
        kind: 'choice',
        question: 'Same twice',
        choices: ['A', 'a'],
        answer: 'A',
      },
      { kind: 'short', question: 'No answer' },
      { kind: 'essay', question: 'Unknown kind, no answer' },
      { kind: 'short', question: 'Kept', answer: 'Yes' },
      { kind: 'short', question: 'kept ', answer: 'Again' },
    ])
    expect(readQuestions(reply, sent).map((each) => each.prompt)).toEqual([
      'Kept',
    ])
    expect(readQuestions(reply, sent, ['choice'])).toEqual([])
  })

  it('keeps only pages that were sent, and works out the source from one', () => {
    const reply = JSON.stringify([
      { kind: 'short', question: 'Q1', answer: 'A', source: 1, page: 9 },
      { kind: 'short', question: 'Q2', answer: 'A', page: 3 },
      { kind: 'short', question: 'Q3', answer: 'A' },
    ])
    expect(readQuestions(reply, sent).map((each) => each.source)).toEqual([
      { kind: 'document', id: 'lecture', page: null },
      { kind: 'document', id: 'lecture', page: 3 },
      null,
    ])
  })

  it('keeps the whole questions of a reply that was cut off', () => {
    const reply =
      '[{"kind":"short","question":"Q1","answer":"A1"},{"kind":"short","question":"Q2","ans'
    expect(readQuestions(reply, sent).map((each) => each.prompt)).toEqual([
      'Q1',
    ])
  })

  it('shuffles choices, the answer following', () => {
    const question: ChoiceQuestion = {
      id: 'q',
      kind: 'choice',
      prompt: 'Q',
      choices: ['right', 'b', 'c', 'd'],
      answer: 0,
      explanation: '',
      source: null,
    }
    const values = [0.9, 0.1, 0.5]
    const shuffled = shuffleChoices(question, () => values.shift() ?? 0)
    expect([...shuffled.choices].sort()).toEqual(['b', 'c', 'd', 'right'])
    expect(shuffled.choices[shuffled.answer]).toBe('right')
  })
})

const choice: ChoiceQuestion = {
  id: 'c1',
  kind: 'choice',
  prompt: 'Which?',
  choices: ['A', 'B', 'C', 'D'],
  answer: 2,
  explanation: '',
  source: null,
}
const short: ShortQuestion = {
  id: 's1',
  kind: 'short',
  prompt: 'Why?',
  answer: 'Because.',
  points: [],
  explanation: '',
  source: null,
}
const third: ShortQuestion = { ...short, id: 's2' }

describe('a go at a quiz', () => {
  it('marks choices at once, and waits for short answers to be marked', () => {
    let attempt = newAttempt(['c1', 's1', 's2'], NOW)
    expect(currentIndex(attempt)).toBe(0)
    attempt = chooseAnswer(attempt, choice, 2, NOW)
    // A choice is final.
    expect(chooseAnswer(attempt, choice, 1, NOW)).toBe(attempt)
    expect(currentIndex(attempt)).toBe(1)

    attempt = writeAnswer(attempt, short, '  Because of it. ', NOW)
    expect(attempt.answers[1]).toMatchObject({
      text: 'Because of it.',
      mark: null,
    })
    // Still being asked until it's marked.
    expect(currentIndex(attempt)).toBe(1)
    expect(finishAttempt(attempt, NOW).finishedAt).toBeNull()

    attempt = markAnswer(attempt, 's1', 'partly', 'ai', 'Say why.')
    attempt = markAnswer(attempt, 's1', 'right', 'self')
    expect(
      attempt.answers.find((each) => each.questionId === 's1'),
    ).toMatchObject({
      mark: 'right',
      markedBy: 'self',
      // What AI said is kept to read back.
      feedback: 'Say why.',
    })

    // Not knowing is marked wrong straight away, and can't be re-marked.
    attempt = writeAnswer(attempt, third, '   ', NOW)
    expect(markAnswer(attempt, 's2', 'right', 'self')).toBe(attempt)
    expect(currentIndex(attempt)).toBe(-1)

    attempt = finishAttempt(attempt, NOW)
    expect(attempt.finishedAt).toBe(NOW.toISOString())
    expect(scoreOf(attempt)).toEqual({
      right: 2,
      partly: 0,
      wrong: 1,
      points: 2,
      total: 3,
    })
    expect(missedIn(attempt)).toEqual(['s2'])
  })

  it('counts partly right as half', () => {
    let attempt = newAttempt(['c1', 's1'], NOW)
    attempt = chooseAnswer(attempt, choice, 0, NOW)
    attempt = writeAnswer(attempt, short, 'Hmm', NOW)
    attempt = markAnswer(attempt, 's1', 'partly', 'self')
    expect(scoreOf(attempt)).toMatchObject({ points: 0.5, wrong: 1, partly: 1 })
    expect(missedIn(attempt)).toEqual(['c1', 's1'])
    expect(formatPoints(7.5)).toBe('7.5')
    expect(formatPoints(0.5)).toBe('0.5')
    expect(formatPoints(3)).toBe('3')
  })
})
