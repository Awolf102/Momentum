import { Link } from 'wouter'
import { QuizIcon, SparkleIcon } from '@/components/icons'
import { useAiReadiness } from '@/features/ai'
import { findSubject, SubjectDot, subjectsStore } from '@/features/subjects'
import { formatDateKey, toDateKey } from '@/lib/date'
import { openSettings, paths } from '@/lib/routes'
import { useStore } from '@/lib/store'
import { lastFinished, openAttempt } from '../actions'
import { answerTo, formatPoints, scoreOf } from '../lib/attempt'
import { quizzes } from '../quizzes'
import type { Quiz } from '../types'
import { plural, primary } from './ui'

/** The Quizzes page: every quiz, newest first, and where you are in each. */
export function QuizzesHome() {
  const all = useStore(quizzes)
  if (all.length === 0) return <EmptyQuizzes />
  return (
    <div className="space-y-5">
      <Link href={paths.newQuiz()} className={primary}>
        <SparkleIcon /> New quiz
      </Link>
      <ul className="space-y-2" aria-label="Quizzes">
        {[...all].reverse().map((quiz) => (
          <QuizRow key={quiz.id} quiz={quiz} />
        ))}
      </ul>
    </div>
  )
}

function EmptyQuizzes() {
  const readiness = useAiReadiness('chat')
  return (
    <div className="rounded-[28px] glass p-6 sm:p-8">
      <span className="flex size-12 items-center justify-center rounded-2xl bg-linear-to-br from-amber-300/25 to-orange-500/25 text-2xl text-orange-300 ring-1 ring-orange-300/30 light:text-orange-500">
        <QuizIcon />
      </span>
      <h2 className="mt-4 text-xl font-semibold tracking-tight">
        Test yourself before the exam does
      </h2>
      <p className="mt-2 max-w-prose text-sm leading-relaxed text-fg-muted">
        Choose notes and PDFs, and AI writes multiple-choice and short-answer
        questions from them. Answers are marked as you go, and each one you miss
        links back to the page it’s on.
      </p>
      <div className="mt-5 flex flex-wrap items-center gap-3">
        <Link href={paths.newQuiz()} className={primary}>
          <SparkleIcon /> New quiz
        </Link>
        {!readiness.ready && (
          <p className="text-sm text-fg-muted">
            First, set up a chat model in{' '}
            <button
              type="button"
              onClick={() => openSettings('ai')}
              className="font-semibold text-fg underline-offset-2 hover:underline"
            >
              Settings → AI
            </button>
            .
          </p>
        )}
      </div>
    </div>
  )
}

function QuizRow({ quiz }: { quiz: Quiz }) {
  // Subject names and colours, as they change.
  useStore(subjectsStore)
  const subject = findSubject(quiz.subjectId)
  const going = openAttempt(quiz)
  // The last go at every question (a go at just the missed ones scores
  // out of fewer), or failing that the last go.
  const finished =
    quiz.attempts.findLast(
      (attempt) =>
        attempt.finishedAt &&
        attempt.questionIds.length === quiz.questions.length,
    ) ?? lastFinished(quiz)
  const score = finished ? scoreOf(finished) : null
  const made = formatDateKey(toDateKey(new Date(quiz.createdAt)), {
    day: 'numeric',
    month: 'short',
  })
  const answered = going
    ? going.questionIds.filter((id) => answerTo(going, id)?.mark).length
    : 0
  return (
    <li>
      <Link
        href={paths.quiz(quiz.id)}
        className="flex items-center gap-4 rounded-[24px] glass px-4 py-3.5 transition hover:bg-tint sm:px-5"
      >
        <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-tint text-lg text-fg-muted">
          <QuizIcon />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px] font-medium">
            {quiz.title}
          </span>
          <span className="mt-0.5 flex min-w-0 items-center gap-1.5 text-xs text-fg-subtle">
            {subject && (
              <>
                <SubjectDot color={subject.color} />
                <span className="truncate">{subject.name}</span>
                <span aria-hidden="true">·</span>
              </>
            )}
            <span className="shrink-0">
              {plural(quiz.questions.length, 'question')} · {made}
            </span>
          </span>
        </span>
        <span className="shrink-0 text-right">
          {going && (answered > 0 || !finished) ? (
            <span className="text-sm font-semibold text-orange-300 light:text-orange-600">
              {answered > 0
                ? `${answered} of ${going.questionIds.length}`
                : 'Start'}
            </span>
          ) : score ? (
            <>
              <span className="block font-serif text-2xl leading-none tabular-nums">
                {formatPoints(score.points)}
                <span className="text-sm text-fg-subtle">/{score.total}</span>
              </span>
              <span className="text-[11px] text-fg-subtle">last time</span>
            </>
          ) : null}
        </span>
      </Link>
    </li>
  )
}
