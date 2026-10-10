import { Link } from 'wouter'
import { ArrowLeftIcon } from '@/components/icons'
import { paths } from '@/lib/routes'
import { retake } from '../actions'
import type { Quiz } from '../types'
import { plural, primary } from './ui'

/** A quiz with no go at it yet (one restored without its answers). */
export function QuizStart({ quiz }: { quiz: Quiz }) {
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
      </div>
      <div className="rounded-[28px] glass-strong p-6 sm:p-8">
        <p className="text-sm text-fg-muted">
          {plural(quiz.questions.length, 'question')}, not taken yet.
        </p>
        <button
          type="button"
          onClick={() => void retake(quiz.id, 'all')}
          className={`${primary} mt-4`}
        >
          Start
        </button>
      </div>
    </div>
  )
}
