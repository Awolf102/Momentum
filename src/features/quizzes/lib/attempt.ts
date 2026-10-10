import { createId } from '@/lib/id'
import type {
  Answer,
  Attempt,
  ChoiceQuestion,
  Mark,
  ShortQuestion,
} from '../types'
import { MAX_ANSWER, MAX_FEEDBACK } from './limits'

export function newAttempt(
  questionIds: readonly string[],
  now: Date = new Date(),
): Attempt {
  return {
    id: createId(),
    questionIds: [...questionIds],
    answers: [],
    startedAt: now.toISOString(),
    finishedAt: null,
  }
}

export const answerTo = (attempt: Attempt, questionId: string) =>
  attempt.answers.find((answer) => answer.questionId === questionId)

/**
 * Where the attempt is: the first question without a marked answer (a
 * short answer given but not yet marked is still being asked). −1 once
 * every one is marked.
 */
export function currentIndex(attempt: Attempt): number {
  return attempt.questionIds.findIndex((id) => !answerTo(attempt, id)?.mark)
}

function withAnswer(attempt: Attempt, answer: Answer): Attempt {
  return {
    ...attempt,
    answers: [
      ...attempt.answers.filter(
        (each) => each.questionId !== answer.questionId,
      ),
      answer,
    ],
  }
}

/** Picking a choice: marked at once, and final. */
export function chooseAnswer(
  attempt: Attempt,
  question: ChoiceQuestion,
  choice: number,
  now: Date = new Date(),
): Attempt {
  if (answerTo(attempt, question.id)) return attempt
  if (
    !Number.isInteger(choice) ||
    choice < 0 ||
    choice >= question.choices.length
  )
    return attempt
  return withAnswer(attempt, {
    questionId: question.id,
    choice,
    text: '',
    mark: choice === question.answer ? 'right' : 'wrong',
    markedBy: 'auto',
    feedback: null,
    answeredAt: now.toISOString(),
  })
}

/**
 * Writing a short answer, to be marked next. Not knowing (nothing
 * written) is marked wrong straight away.
 */
export function writeAnswer(
  attempt: Attempt,
  question: ShortQuestion,
  text: string,
  now: Date = new Date(),
): Attempt {
  if (answerTo(attempt, question.id)) return attempt
  const written = text.trim().slice(0, MAX_ANSWER)
  return withAnswer(attempt, {
    questionId: question.id,
    choice: null,
    text: written,
    mark: written ? null : 'wrong',
    markedBy: written ? null : 'auto',
    feedback: null,
    answeredAt: now.toISOString(),
  })
}

/** Marking a short answer, by you or by AI; you can change AI's mark. */
export function markAnswer(
  attempt: Attempt,
  questionId: string,
  mark: Mark,
  by: 'self' | 'ai',
  feedback: string | null = null,
): Attempt {
  const answer = answerTo(attempt, questionId)
  if (!answer || answer.markedBy === 'auto') return attempt
  return withAnswer(attempt, {
    ...answer,
    mark,
    markedBy: by,
    // Your own mark keeps what AI said, to read back.
    feedback:
      by === 'ai'
        ? (feedback?.slice(0, MAX_FEEDBACK) ?? null)
        : answer.feedback,
  })
}

/** Done once every question is marked. */
export function finishAttempt(
  attempt: Attempt,
  now: Date = new Date(),
): Attempt {
  if (attempt.finishedAt || currentIndex(attempt) !== -1) return attempt
  return { ...attempt, finishedAt: now.toISOString() }
}

export interface Score {
  right: number
  partly: number
  wrong: number
  /** Right answers, and half for each partly right one. */
  points: number
  total: number
}

export function scoreOf(attempt: Attempt): Score {
  const score = { right: 0, partly: 0, wrong: 0 }
  for (const id of attempt.questionIds) {
    const mark = answerTo(attempt, id)?.mark
    if (mark) score[mark]++
  }
  return {
    ...score,
    points: score.right + score.partly / 2,
    total: attempt.questionIds.length,
  }
}

/** The questions not got right: wrong, or only partly right. */
export function missedIn(attempt: Attempt): string[] {
  return attempt.questionIds.filter((id) => {
    const mark = answerTo(attempt, id)?.mark
    return mark === 'wrong' || mark === 'partly'
  })
}

/**
 * 7.5 → "7.5", 3 → "3". (Not "7½": in the display font that reads as
 * "71⁄2".)
 */
export function formatPoints(points: number): string {
  return Number.isInteger(points) ? `${points}` : points.toFixed(1)
}
