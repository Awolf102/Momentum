import { createId } from '@/lib/id'
import { answerTo, missedIn, newAttempt } from './lib/attempt'
import { MAX_ATTEMPTS, MAX_TITLE } from './lib/limits'
import { shuffled } from './lib/questions'
import { quizzes } from './quizzes'
import type {
  Attempt,
  Question,
  QuestionSource,
  Quiz,
  QuizSource,
} from './types'

/** A quiz's name from what it was made from: "Lecture 5", "A and B", "A, B and 2 more". */
export function quizTitle(
  sources: readonly Pick<QuizSource, 'title'>[],
): string {
  const titles = sources.map((source) => source.title.trim() || 'Untitled')
  const title =
    titles.length <= 1
      ? (titles[0] ?? 'Quiz')
      : titles.length === 2
        ? `${titles[0]} and ${titles[1]}`
        : `${titles[0]}, ${titles[1]} and ${titles.length - 2} more`
  return title.slice(0, MAX_TITLE)
}

/** Saves a new quiz, with a first go at it ready to start. */
export async function createQuiz(
  {
    title,
    subjectId,
    sources,
    questions,
    madeBy,
  }: Pick<Quiz, 'title' | 'subjectId' | 'sources' | 'questions' | 'madeBy'>,
  now: Date = new Date(),
): Promise<Quiz> {
  const stamp = now.toISOString()
  const quiz: Quiz = {
    id: createId(),
    title: title.trim().slice(0, MAX_TITLE) || quizTitle(sources),
    subjectId,
    sources,
    questions,
    ...(madeBy ? { madeBy } : {}),
    attempts: [
      newAttempt(
        questions.map((question) => question.id),
        now,
      ),
    ],
    createdAt: stamp,
    updatedAt: stamp,
    deletedAt: null,
  }
  await quizzes.add(quiz)
  return quiz
}

/** Saves a go at a quiz (each answer is saved as it's given). */
export async function saveAttempt(
  quizId: string,
  attempt: Attempt,
  now: Date = new Date(),
): Promise<void> {
  const quiz = quizzes.find(quizId)
  if (!quiz || quiz.deletedAt) return
  const known = quiz.attempts.some((each) => each.id === attempt.id)
  await quizzes.put({
    ...quiz,
    attempts: known
      ? quiz.attempts.map((each) => (each.id === attempt.id ? attempt : each))
      : [...quiz.attempts, attempt].slice(-MAX_ATTEMPTS),
    updatedAt: now.toISOString(),
  })
}

/** The go that's still going, if there is one. */
export const openAttempt = (quiz: Quiz): Attempt | undefined =>
  quiz.attempts.findLast((attempt) => !attempt.finishedAt)

/** The last finished go. */
export const lastFinished = (quiz: Quiz): Attempt | undefined =>
  quiz.attempts.findLast((attempt) => attempt.finishedAt)

/**
 * Another go: every question, or the ones missed last time, in a new order.
 * One that's still going is left for this one.
 */
export async function retake(
  quizId: string,
  which: 'all' | 'missed',
  {
    now = new Date(),
    random = Math.random,
  }: { now?: Date; random?: () => number } = {},
): Promise<Attempt | null> {
  const quiz = quizzes.find(quizId)
  if (!quiz || quiz.deletedAt) return null
  const last = lastFinished(quiz)
  const ids =
    which === 'missed' && last
      ? missedIn(last)
      : quiz.questions.map((question) => question.id)
  if (ids.length === 0) return null
  const attempt = newAttempt(shuffled(ids, random), now)
  await quizzes.put({
    ...quiz,
    attempts: [
      ...quiz.attempts.filter((each) => each.finishedAt),
      attempt,
    ].slice(-MAX_ATTEMPTS),
    updatedAt: now.toISOString(),
  })
  return attempt
}

/** Drops the go under way, with its answers (Undo saves it back). */
export async function stopAttempt(
  quizId: string,
  now: Date = new Date(),
): Promise<Attempt | null> {
  const quiz = quizzes.find(quizId)
  const going = quiz && !quiz.deletedAt ? openAttempt(quiz) : undefined
  if (!quiz || !going) return null
  await quizzes.put({
    ...quiz,
    attempts: quiz.attempts.filter((attempt) => attempt.id !== going.id),
    updatedAt: now.toISOString(),
  })
  return going
}

export async function updateQuiz(
  id: string,
  changes: Partial<Pick<Quiz, 'title' | 'subjectId'>>,
  now: Date = new Date(),
): Promise<void> {
  const quiz = quizzes.find(id)
  if (!quiz || quiz.deletedAt) return
  const title =
    changes.title === undefined
      ? quiz.title
      : changes.title.trim().slice(0, MAX_TITLE) || quiz.title
  await quizzes.put({
    ...quiz,
    ...changes,
    title,
    updatedAt: now.toISOString(),
  })
}

export const deleteQuiz = (id: string) => quizzes.remove(id)

export async function restoreQuiz(
  id: string,
  now: Date = new Date(),
): Promise<void> {
  const quiz = quizzes.find(id)
  if (!quiz?.deletedAt) return
  await quizzes.put({ ...quiz, deletedAt: null, updatedAt: now.toISOString() })
}

/** A card made from a question: the question on the front, the answer on the back. */
export interface CardFromQuestion {
  front: string
  back: string
  source: QuestionSource | null
}

/**
 * Cards for the questions a go missed. A multiple-choice question keeps its
 * choices on the front (it may ask "which of these…"); the back has the
 * answer and why.
 */
export function cardsFromMissed(
  quiz: Quiz,
  attempt: Attempt,
): CardFromQuestion[] {
  const byId = new Map(
    quiz.questions.map((question) => [question.id, question]),
  )
  return missedIn(attempt)
    .map((id) => byId.get(id))
    .filter((question): question is Question => question !== undefined)
    .map((question) => {
      const why = question.explanation ? `\n\n${question.explanation}` : ''
      return question.kind === 'choice'
        ? {
            front: `${question.prompt}\n\n${question.choices.map((choice) => `- ${choice}`).join('\n')}`,
            back: `**${question.choices[question.answer]}**${why}`,
            source: question.source,
          }
        : {
            front: question.prompt,
            back: `${question.answer}${why}`,
            source: question.source,
          }
    })
}

/** Whether you've answered anything in a go (so leaving it loses nothing). */
export const started = (attempt: Attempt) =>
  attempt.questionIds.some((id) => answerTo(attempt, id))
