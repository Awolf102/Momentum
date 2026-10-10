import { useState, type ReactNode } from 'react'
import { Link, Redirect, useParams, useSearch } from 'wouter'
import { ArrowLeftIcon } from '@/components/icons'
import {
  lastFinished,
  NewQuiz,
  openAttempt,
  QuizResults,
  QuizSession,
  QuizSheet,
  QuizStart,
  quizzes,
  QuizzesHome,
} from '@/features/quizzes/page'
import { paths } from '@/lib/routes'
import { useStore } from '@/lib/store'

function Titled({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col pt-2 pb-8 sm:pt-6 lg:pt-2">
      <div className="mb-6 flex items-center gap-3">
        <Link
          href={paths.quizzes}
          aria-label="Back to quizzes"
          className="flex size-10 shrink-0 items-center justify-center rounded-full glass text-lg transition hover:bg-tint"
        >
          <ArrowLeftIcon />
        </Link>
        <h1 className="font-serif text-4xl leading-none tracking-tight text-shadow-soft sm:text-5xl">
          {title}
        </h1>
      </div>
      {children}
    </div>
  )
}

/** One quiz: the go under way, or how the last one went. */
function QuizView({ id }: { id: string }) {
  const quiz = useStore(quizzes).find((each) => each.id === id)
  const [details, setDetails] = useState(false)
  if (!quiz) return <Redirect to={paths.quizzes} replace />
  const going = openAttempt(quiz)
  const finished = lastFinished(quiz)
  return (
    <div className="flex w-full flex-1 flex-col pt-2 pb-8 sm:pt-6 lg:pt-2">
      {going ? (
        <QuizSession
          key={going.id}
          quiz={quiz}
          attempt={going}
          onDetails={() => setDetails(true)}
        />
      ) : finished ? (
        <QuizResults
          quiz={quiz}
          attempt={finished}
          onDetails={() => setDetails(true)}
        />
      ) : (
        <QuizStart quiz={quiz} />
      )}
      <QuizSheet quiz={quiz} open={details} onClose={() => setDetails(false)} />
    </div>
  )
}

export default function QuizzesPage() {
  const { id } = useParams<{ id?: string }>()
  const params = new URLSearchParams(useSearch())

  if (id === 'new')
    return (
      <Titled title="New quiz">
        <NewQuiz
          noteId={params.get('note')}
          documentId={params.get('document')}
        />
      </Titled>
    )

  if (id) return <QuizView key={id} id={id} />

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col pt-2 pb-8 sm:pt-6 lg:pt-2">
      <h1 className="font-serif text-5xl leading-none tracking-tight text-shadow-soft sm:text-6xl">
        Quizzes
      </h1>
      <p className="mt-3 text-[15px] text-fg-muted text-shadow-soft">
        Practice questions from your notes and PDFs, marked as you go.
      </p>
      <div className="mt-6">
        <QuizzesHome />
      </div>
    </div>
  )
}
