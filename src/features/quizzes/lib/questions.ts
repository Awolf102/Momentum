import { jsonItems } from '@/features/ai/material'
import { createId } from '@/lib/id'
import type {
  ChoiceQuestion,
  Question,
  QuestionKind,
  QuestionSource,
} from '../types'
import {
  MAX_ANSWER,
  MAX_CHOICE,
  MAX_CHOICES,
  MAX_EXPLANATION,
  MAX_POINT,
  MAX_POINTS,
  MAX_PROMPT,
} from './limits'

/** A source as it was sent, numbered from 1 in the request. */
export interface SentSource {
  kind: 'note' | 'document'
  id: string
  /** The pages sent, for a document. */
  pages: readonly number[] | null
}

const text = (value: unknown, max: number): string =>
  typeof value === 'string' ? value.trim().slice(0, max) : ''

const firstText = (
  item: Record<string, unknown>,
  names: readonly string[],
  max: number,
): string => {
  for (const name of names) {
    const value = text(item[name], max)
    if (value) return value
  }
  return ''
}

/** "B) Flip-flop", "(b) flip-flop." and "Flip-flop" are the same choice. */
const LABEL = /^\(?([a-f])[).:]\s+/i
const normalise = (value: string) =>
  value
    .replace(LABEL, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[.。]$/, '')
    .trim()

function kindOf(item: Record<string, unknown>): QuestionKind | null {
  const kind = String(item.kind ?? item.type ?? '')
    .toLowerCase()
    .replace(/[\s_-]+/g, '')
  if (['choice', 'multiplechoice', 'mcq', 'mc'].includes(kind)) return 'choice'
  if (['short', 'shortanswer', 'open', 'written'].includes(kind)) return 'short'
  if (Array.isArray(item.choices ?? item.options)) return 'choice'
  if (typeof item.answer === 'string') return 'short'
  return null
}

/** Choices labelled "A) …", "B) …" in order lose the labels. */
function unlabel(choices: string[]): string[] {
  const labelled = choices.every((choice, index) => {
    const label = LABEL.exec(choice)
    return label && label[1].toLowerCase() === 'abcdef'[index]
  })
  return labelled ? choices.map((choice) => choice.replace(LABEL, '')) : choices
}

/**
 * The right choice, from its text (as the model is asked for) or a letter
 * ("B"). A bare number is left alone: counting from 0 or from 1 can't be
 * told apart, and a wrong key is worse than a question less.
 */
function answerIndex(answer: unknown, choices: readonly string[]): number {
  if (typeof answer !== 'string' || !answer.trim()) return -1
  const wanted = normalise(answer)
  const index = choices.findIndex((choice) => normalise(choice) === wanted)
  if (index !== -1) return index
  const letter = /^\(?([a-f])[).:]?$/i.exec(answer.trim())
  if (!letter) return -1
  const at = letter[1].toLowerCase().charCodeAt(0) - 97
  return at < choices.length ? at : -1
}

/** Where a question comes from: the source it names, and a page sent from it. */
function sourceOf(
  item: Record<string, unknown>,
  sent: readonly SentSource[],
): QuestionSource | null {
  const number = Number(item.source)
  const page =
    typeof item.page === 'number' && Number.isInteger(item.page)
      ? item.page
      : Number.NaN
  let source: SentSource | undefined =
    Number.isInteger(number) && number >= 1 ? sent[number - 1] : undefined
  if (!source && sent.length === 1) source = sent[0]
  // No source given: the one document that page was sent from.
  if (!source && !Number.isNaN(page)) {
    const having = sent.filter((each) => each.pages?.includes(page))
    if (having.length === 1) source = having[0]
  }
  if (!source) return null
  return {
    kind: source.kind,
    id: source.id,
    page: source.pages?.includes(page) ? page : null,
  }
}

/**
 * The questions in a model's reply (a JSON list, even cut off part way),
 * checked: a choice question needs two to six different choices and a
 * right one it names; a short one, a model answer. Repeats are left out,
 * and pages are kept only when they were sent.
 */
export function readQuestions(
  reply: string,
  sent: readonly SentSource[],
  kinds: readonly QuestionKind[] = ['choice', 'short'],
): Question[] {
  const questions: Question[] = []
  const seen = new Set<string>()
  for (const item of jsonItems(reply)) {
    const kind = kindOf(item)
    const prompt = firstText(item, ['question', 'prompt'], MAX_PROMPT)
    if (!kind || !kinds.includes(kind) || !prompt) continue
    const key = normalise(prompt)
    if (seen.has(key)) continue
    const base = {
      id: createId(),
      prompt,
      explanation: firstText(
        item,
        ['explanation', 'why', 'reason'],
        MAX_EXPLANATION,
      ),
      source: sourceOf(item, sent),
    }
    if (kind === 'choice') {
      const raw = item.choices ?? item.options
      if (!Array.isArray(raw)) continue
      const choices = unlabel(
        raw.map((choice) => text(choice, MAX_CHOICE)).filter(Boolean),
      )
      const distinct = new Set(choices.map(normalise))
      if (
        choices.length < 2 ||
        choices.length > MAX_CHOICES ||
        distinct.size !== choices.length
      )
        continue
      const answer = answerIndex(item.answer ?? item.correct, choices)
      if (answer === -1) continue
      questions.push({ ...base, kind, choices, answer })
    } else {
      const answer = firstText(
        item,
        ['answer', 'model_answer', 'modelAnswer'],
        MAX_ANSWER,
      )
      if (!answer) continue
      const raw = item.points ?? item.key_points ?? item.keyPoints
      const points = Array.isArray(raw)
        ? raw
            .map((point) => text(point, MAX_POINT))
            .filter(Boolean)
            .slice(0, MAX_POINTS)
        : []
      questions.push({ ...base, kind, answer, points })
    }
    seen.add(key)
  }
  return questions
}

/**
 * A question's choices in a random order (models favour putting the right
 * one first), with the answer following it.
 */
export function shuffleChoices(
  question: ChoiceQuestion,
  random: () => number = Math.random,
): ChoiceQuestion {
  const order = shuffled(
    question.choices.map((_, index) => index),
    random,
  )
  return {
    ...question,
    choices: order.map((index) => question.choices[index]),
    answer: order.indexOf(question.answer),
  }
}

/** A list in a random order (for taking a quiz again). */
export function shuffled<T>(
  list: readonly T[],
  random: () => number = Math.random,
): T[] {
  const copy = [...list]
  for (let at = copy.length - 1; at > 0; at--) {
    const swap = Math.floor(random() * (at + 1))
    ;[copy[at], copy[swap]] = [copy[swap], copy[at]]
  }
  return copy
}
