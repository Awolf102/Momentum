import type { CollectionRecord } from '@/lib/collection'

/** A note or document a quiz was made from, and what of it was sent. */
export interface QuizSource {
  kind: 'note' | 'document'
  id: string
  /** Its title when the quiz was made (it may have changed or gone since). */
  title: string
  /** A document's pages that were sent; null for a note. */
  pages: number[] | null
}

/** Where a question's answer is, to go back and read it. */
export interface QuestionSource {
  kind: 'note' | 'document'
  id: string
  /** A document's page. */
  page: number | null
}

interface BaseQuestion {
  id: string
  /** The question, in markdown (maths and code included). */
  prompt: string
  /** Why the answer is right. */
  explanation: string
  source: QuestionSource | null
}

export interface ChoiceQuestion extends BaseQuestion {
  kind: 'choice'
  choices: string[]
  /** The right choice's position. */
  answer: number
}

export interface ShortQuestion extends BaseQuestion {
  kind: 'short'
  /** A model answer. */
  answer: string
  /** What a right answer has to include. */
  points: string[]
}

export type Question = ChoiceQuestion | ShortQuestion
export type QuestionKind = Question['kind']

/** How an answer went: a short answer that was partly right counts half. */
export type Mark = 'right' | 'partly' | 'wrong'

export interface Answer {
  questionId: string
  /** The choice picked, for multiple choice. */
  choice: number | null
  /** What was written, for a short answer ("" when you didn't know). */
  text: string
  /** Null until a short answer is marked. */
  mark: Mark | null
  /** Multiple choice marks itself; a short answer is marked by you or AI. */
  markedBy: 'auto' | 'self' | 'ai' | null
  /** AI's comment on a short answer. */
  feedback: string | null
  answeredAt: string
}

/** One go at a quiz: all its questions, or the ones missed last time. */
export interface Attempt {
  id: string
  questionIds: string[]
  answers: Answer[]
  startedAt: string
  finishedAt: string | null
}

export interface Quiz extends CollectionRecord {
  title: string
  subjectId: string | null
  sources: QuizSource[]
  questions: Question[]
  /** Oldest first; the last may still be going. */
  attempts: Attempt[]
}
