import { createCollection } from '@/lib/collection'
import { isRecord } from '@/lib/guards'
import {
  MAX_ANSWER,
  MAX_ATTEMPTS,
  MAX_CHOICE,
  MAX_CHOICES,
  MAX_EXPLANATION,
  MAX_FEEDBACK,
  MAX_POINT,
  MAX_POINTS,
  MAX_PROMPT,
  MAX_QUESTIONS,
  MAX_TITLE,
} from './lib/limits'
import type {
  Answer,
  Attempt,
  Mark,
  Question,
  QuestionSource,
  Quiz,
  QuizSource,
} from './types'

// Reading quizzes back from storage or a backup: anything malformed is
// dropped or trimmed rather than trusted.

const text = (value: unknown, max: number) =>
  typeof value === 'string' ? value.slice(0, max) : ''

const isKind = (value: unknown): value is 'note' | 'document' =>
  value === 'note' || value === 'document'

const isPage = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value > 0

const isMark = (value: unknown): value is Mark =>
  value === 'right' || value === 'partly' || value === 'wrong'

const stamp = (value: unknown) => (typeof value === 'string' ? value : null)

function parseSource(value: unknown): QuizSource | null {
  if (!isRecord(value) || !isKind(value.kind) || typeof value.id !== 'string')
    return null
  return {
    kind: value.kind,
    id: value.id,
    title: text(value.title, MAX_TITLE),
    pages:
      value.kind === 'document' && Array.isArray(value.pages)
        ? value.pages.filter(isPage)
        : null,
  }
}

function parseQuestionSource(value: unknown): QuestionSource | null {
  if (!isRecord(value) || !isKind(value.kind) || typeof value.id !== 'string')
    return null
  return {
    kind: value.kind,
    id: value.id,
    page: value.kind === 'document' && isPage(value.page) ? value.page : null,
  }
}

function parseQuestion(value: unknown): Question | null {
  if (!isRecord(value) || typeof value.id !== 'string') return null
  const prompt = text(value.prompt, MAX_PROMPT)
  if (!prompt) return null
  const base = {
    id: value.id,
    prompt,
    explanation: text(value.explanation, MAX_EXPLANATION),
    source: parseQuestionSource(value.source),
  }
  if (value.kind === 'choice') {
    if (!Array.isArray(value.choices)) return null
    const choices = value.choices
      .slice(0, MAX_CHOICES)
      .map((choice) => text(choice, MAX_CHOICE))
    const { answer } = value
    if (
      choices.length < 2 ||
      choices.some((choice) => !choice) ||
      typeof answer !== 'number' ||
      !Number.isInteger(answer) ||
      answer < 0 ||
      answer >= choices.length
    )
      return null
    return { ...base, kind: 'choice', choices, answer }
  }
  if (value.kind === 'short') {
    const answer = text(value.answer, MAX_ANSWER)
    if (!answer) return null
    return {
      ...base,
      kind: 'short',
      answer,
      points: Array.isArray(value.points)
        ? value.points
            .map((point) => text(point, MAX_POINT))
            .filter(Boolean)
            .slice(0, MAX_POINTS)
        : [],
    }
  }
  return null
}

function parseAnswer(
  value: unknown,
  questions: ReadonlyMap<string, Question>,
): Answer | null {
  if (!isRecord(value) || typeof value.questionId !== 'string') return null
  const question = questions.get(value.questionId)
  const answeredAt = stamp(value.answeredAt)
  if (!question || !answeredAt) return null
  const markedBy =
    value.markedBy === 'auto' ||
    value.markedBy === 'self' ||
    value.markedBy === 'ai'
      ? value.markedBy
      : null
  const mark = isMark(value.mark) && markedBy ? value.mark : null
  if (question.kind === 'choice') {
    const { choice } = value
    if (
      typeof choice !== 'number' ||
      !Number.isInteger(choice) ||
      choice < 0 ||
      choice >= question.choices.length
    )
      return null
    // A choice marks itself, so the mark can't disagree with the key.
    return {
      questionId: question.id,
      choice,
      text: '',
      mark: choice === question.answer ? 'right' : 'wrong',
      markedBy: 'auto',
      feedback: null,
      answeredAt,
    }
  }
  return {
    questionId: question.id,
    choice: null,
    text: text(value.text, MAX_ANSWER),
    mark,
    markedBy: mark ? markedBy : null,
    feedback:
      typeof value.feedback === 'string'
        ? value.feedback.slice(0, MAX_FEEDBACK)
        : null,
    answeredAt,
  }
}

function parseAttempt(
  value: unknown,
  questions: ReadonlyMap<string, Question>,
): Attempt | null {
  if (!isRecord(value) || typeof value.id !== 'string') return null
  const startedAt = stamp(value.startedAt)
  if (!startedAt || !Array.isArray(value.questionIds)) return null
  const questionIds = [
    ...new Set(
      value.questionIds.filter(
        (id): id is string => typeof id === 'string' && questions.has(id),
      ),
    ),
  ]
  if (questionIds.length === 0) return null
  const answers = (Array.isArray(value.answers) ? value.answers : [])
    .map((answer) => parseAnswer(answer, questions))
    .filter((answer): answer is Answer => answer !== null)
    .filter((answer) => questionIds.includes(answer.questionId))
  const marked = questionIds.every(
    (id) => answers.find((answer) => answer.questionId === id)?.mark,
  )
  return {
    id: value.id,
    questionIds,
    answers,
    startedAt,
    // Only a fully marked attempt counts as finished.
    finishedAt: marked ? stamp(value.finishedAt) : null,
  }
}

export function parseQuiz(value: unknown): Quiz | null {
  if (!isRecord(value)) return null
  const { id, updatedAt, createdAt, deletedAt } = value
  if (typeof id !== 'string' || typeof updatedAt !== 'string') return null
  const questions = (Array.isArray(value.questions) ? value.questions : [])
    .slice(0, MAX_QUESTIONS)
    .map(parseQuestion)
    .filter((question): question is Question => question !== null)
  if (questions.length === 0) return null
  const byId = new Map(questions.map((question) => [question.id, question]))
  const attempts = (Array.isArray(value.attempts) ? value.attempts : [])
    .map((attempt) => parseAttempt(attempt, byId))
    .filter((attempt): attempt is Attempt => attempt !== null)
    .slice(-MAX_ATTEMPTS)
  return {
    id,
    title: text(value.title, MAX_TITLE).trim() || 'Quiz',
    subjectId: typeof value.subjectId === 'string' ? value.subjectId : null,
    sources: (Array.isArray(value.sources) ? value.sources : [])
      .map(parseSource)
      .filter((source): source is QuizSource => source !== null),
    questions,
    attempts,
    ...(typeof value.madeBy === 'string' && value.madeBy
      ? { madeBy: value.madeBy.slice(0, MAX_TITLE) }
      : {}),
    createdAt: typeof createdAt === 'string' ? createdAt : updatedAt,
    updatedAt,
    deletedAt: typeof deletedAt === 'string' ? deletedAt : null,
  }
}

/** Every practice quiz, with its questions and the goes at it. */
export const quizzes = createCollection<Quiz>({
  name: 'quizzes',
  parse: parseQuiz,
})
