import { useState } from 'react'
import { Link } from 'wouter'
import {
  ArrowLeftIcon,
  CardsIcon,
  MoreIcon,
  RefreshIcon,
} from '@/components/icons'
import { cards } from '@/features/flashcards'
import { addCards, findSimilar } from '@/features/flashcards/actions'
import { MarkdownView } from '@/features/notes/view'
import { cn } from '@/lib/cn'
import { navigate, paths } from '@/lib/routes'
import { useStore } from '@/lib/store'
import { toast } from '@/lib/toast'
import { cardsFromMissed, retake } from '../actions'
import { answerTo, formatPoints, missedIn, scoreOf } from '../lib/attempt'
import type { Answer, Attempt, Question, Quiz } from '../types'
import { SourceLink } from './parts'
import { MARKS, plural, primary, secondary } from './ui'

/** How long a go took, in words. */
function took(attempt: Attempt): string {
  const minutes = Math.round(
    (Date.parse(attempt.finishedAt!) - Date.parse(attempt.startedAt)) / 60_000,
  )
  if (minutes < 1) return 'in under a minute'
  if (minutes < 120) return `in ${plural(minutes, 'minute')}`
  return 'over more than one sitting'
}

/**
 * How a go went: the score, then each question missed with your answer,
 * the right one, why, and a link back to the page it's on.
 */
export function QuizResults({
  quiz,
  attempt,
  onDetails,
}: {
  quiz: Quiz
  attempt: Attempt
  onDetails: () => void
}) {
  // Cards made from this go show as made.
  useStore(cards)
  const [busy, setBusy] = useState(false)
  const score = scoreOf(attempt)
  const missed = missedIn(attempt)
  const byId = new Map(
    quiz.questions.map((question) => [question.id, question]),
  )
  const finished = quiz.attempts.filter((each) => each.finishedAt)
  const before = finished
    .slice(
      0,
      finished.findIndex((each) => each.id === attempt.id),
    )
    .findLast((each) => each.questionIds.length === score.total)
  const drafts = cardsFromMissed(quiz, attempt).filter(
    (draft) => !findSimilar(draft.front, draft.source),
  )
  const whole = score.total === quiz.questions.length

  async function again(which: 'all' | 'missed') {
    setBusy(true)
    try {
      // The page shows the new go once it's saved.
      await retake(quiz.id, which)
    } finally {
      setBusy(false)
    }
  }

  async function makeCards() {
    setBusy(true)
    try {
      const made = await addCards(drafts, { subjectId: quiz.subjectId })
      toast({
        title: `${plural(made.length, 'card')} added`,
        action: { label: 'Study', run: () => navigate(paths.study()) },
      })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto w-full max-w-2xl space-y-5">
      <div className="flex items-center gap-3">
        <Link
          href={paths.quizzes}
          aria-label="Back to quizzes"
          className="flex size-10 shrink-0 items-center justify-center rounded-full glass text-lg transition hover:bg-tint"
        >
          <ArrowLeftIcon />
        </Link>
        <h1 className="min-w-0 flex-1 truncate text-lg font-semibold tracking-tight text-shadow-soft">
          {quiz.title}
        </h1>
        <button
          type="button"
          onClick={onDetails}
          aria-label="Quiz details"
          className="flex size-10 shrink-0 items-center justify-center rounded-full text-lg text-fg-muted transition hover:bg-tint hover:text-fg"
        >
          <MoreIcon />
        </button>
      </div>

      <section
        aria-label="Score"
        className="rounded-[28px] glass-strong p-6 sm:p-8"
      >
        <p className="text-[11px] font-semibold tracking-[0.18em] text-fg-subtle uppercase">
          {whole ? 'Your score' : 'The ones you missed, again'}
        </p>
        <p className="mt-1 font-serif text-6xl leading-none tracking-tight tabular-nums">
          {formatPoints(score.points)}
          <span className="ml-2 text-3xl text-fg-subtle">of {score.total}</span>
        </p>
        <p className="mt-3 text-sm text-fg-muted">
          {[
            score.right && `${score.right} right`,
            score.partly && `${score.partly} partly right`,
            score.wrong && `${score.wrong} wrong`,
          ]
            .filter(Boolean)
            .join(' · ')}{' '}
          · {took(attempt)}
          {before &&
            ` · last time ${formatPoints(scoreOf(before).points)} of ${score.total}`}
        </p>
        <div className="mt-6 flex flex-wrap gap-2">
          {missed.length > 0 && (
            <button
              type="button"
              disabled={busy}
              onClick={() => void again('missed')}
              className={primary}
            >
              <RefreshIcon />
              {missed.length === 1
                ? 'Try the one you missed again'
                : `Try the ${missed.length} you missed again`}
            </button>
          )}
          <button
            type="button"
            disabled={busy}
            onClick={() => void again('all')}
            className={missed.length ? secondary : primary}
          >
            <RefreshIcon /> Take it again
          </button>
          {missed.length > 0 && (
            <button
              type="button"
              disabled={busy || drafts.length === 0}
              onClick={() => void makeCards()}
              className={secondary}
            >
              <CardsIcon />
              {drafts.length
                ? `Make ${plural(drafts.length, 'card')} to remember them`
                : 'Cards made'}
            </button>
          )}
        </div>
      </section>

      {missed.length > 0 && (
        <section aria-labelledby="go-over" className="space-y-3">
          <h2
            id="go-over"
            className="px-1 text-[11px] font-semibold tracking-[0.18em] text-fg-subtle uppercase"
          >
            To go over
          </h2>
          <ol className="space-y-3">
            {missed.map((id) => {
              const question = byId.get(id)
              const answer = answerTo(attempt, id)
              if (!question || !answer) return null
              return (
                <li key={id}>
                  <Missed question={question} answer={answer} quiz={quiz} />
                </li>
              )
            })}
          </ol>
        </section>
      )}

      {score.right > 0 && (
        <details className="group rounded-[24px] glass p-5">
          <summary className="cursor-pointer text-sm font-medium text-fg-muted marker:text-fg-subtle">
            {plural(score.right, 'question')} you got right
          </summary>
          <ol className="mt-3 space-y-2 text-sm">
            {attempt.questionIds
              .filter((id) => answerTo(attempt, id)?.mark === 'right')
              .map((id) => (
                <li key={id} className="flex gap-2">
                  <span className="text-emerald-300 light:text-emerald-700">
                    {MARKS[0].icon}
                  </span>
                  <span className="min-w-0 flex-1">
                    <MarkdownView markdown={byId.get(id)?.prompt ?? ''} />
                  </span>
                </li>
              ))}
          </ol>
        </details>
      )}
    </div>
  )
}

function Missed({
  question,
  answer,
  quiz,
}: {
  question: Question
  answer: Answer
  quiz: Quiz
}) {
  const verdict = MARKS.find((each) => each.mark === answer.mark)!
  const yours =
    question.kind === 'choice'
      ? (question.choices[answer.choice ?? -1] ?? '')
      : answer.text
  const right =
    question.kind === 'choice'
      ? question.choices[question.answer]
      : question.answer
  return (
    <article className="rounded-[24px] glass p-5">
      <div className="text-[15px] font-medium">
        <MarkdownView markdown={question.prompt} />
      </div>
      <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
        <div>
          <dt
            className={cn(
              'flex items-center gap-1 text-xs font-semibold',
              verdict.tone,
            )}
          >
            {verdict.icon} You answered
            {answer.mark === 'partly' ? ' (partly right)' : ''}
          </dt>
          <dd className="mt-1 text-fg-muted">
            {yours ? (
              <MarkdownView markdown={yours} />
            ) : (
              <span className="italic">You didn’t know.</span>
            )}
          </dd>
        </div>
        <div>
          <dt className="flex items-center gap-1 text-xs font-semibold text-emerald-300 light:text-emerald-700">
            {MARKS[0].icon} The answer
          </dt>
          <dd className="mt-1">
            <MarkdownView markdown={right} />
          </dd>
        </div>
      </dl>
      {(answer.feedback || question.explanation) && (
        <div className="mt-3 space-y-1.5 text-sm text-fg-muted">
          {answer.feedback && <p>{answer.feedback}</p>}
          {question.explanation && (
            <MarkdownView markdown={question.explanation} />
          )}
        </div>
      )}
      {question.source && (
        <p className="mt-4 flex min-w-0 items-center gap-2 text-xs text-fg-subtle">
          <span className="shrink-0">Read it again:</span>
          <SourceLink source={question.source} quiz={quiz} />
        </p>
      )}
    </article>
  )
}
