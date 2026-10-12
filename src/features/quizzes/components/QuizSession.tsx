import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'wouter'
import {
  ArrowLeftIcon,
  CheckIcon,
  CloseIcon,
  MoreIcon,
  SparkleIcon,
} from '@/components/icons'
import {
  describeAiError,
  isAiError,
  PROVIDERS,
  ReplyStatus,
  startReply,
  useAiReadiness,
  type ReplyProgress,
} from '@/features/ai'
import { MarkdownView } from '@/features/notes/view'
import { cn } from '@/lib/cn'
import { useHotkeys } from '@/lib/hotkeys'
import { paths } from '@/lib/routes'
import { saveAttempt } from '../actions'
import { checkAnswer } from '../generate'
import {
  answerTo,
  chooseAnswer,
  currentIndex,
  finishAttempt,
  markAnswer,
  writeAnswer,
} from '../lib/attempt'
import type { Answer, Attempt, Mark, Question, Quiz } from '../types'
import { SourceLink } from './parts'
import { MARKS, primary, secondary } from './ui'

/** The time, read in event handlers (never while rendering). */
const timeNow = () => new Date()

/**
 * Taking a quiz, one question at a time. Multiple choice: 1–4 picks, and
 * it's marked at once. Short answer: Enter checks it against the model
 * answer, then you mark it (1–3) or have AI mark it (G). Enter moves on.
 * Each answer is saved as it's given, so leaving loses nothing.
 */
export function QuizSession({
  quiz,
  attempt: initial,
  onDetails,
}: {
  quiz: Quiz
  attempt: Attempt
  onDetails: () => void
}) {
  const byId = useMemo(
    () => new Map(quiz.questions.map((question) => [question.id, question])),
    [quiz.questions],
  )
  const [attempt, setAttempt] = useState(initial)
  const [shownId, setShownId] = useState(
    () => initial.questionIds[Math.max(0, currentIndex(initial))],
  )
  // Keys can come faster than React re-renders: the attempt and the
  // question on screen are read from refs, so a key pressed twice answers
  // once, and Enter right after an answer moves on from that question.
  const latest = useRef(initial)
  const shown = useRef(shownId)
  const [written, setWritten] = useState('')
  const [checking, setChecking] = useState(false)
  const [progress, setProgress] = useState<ReplyProgress>({ since: 0 })
  const [checkProblem, setCheckProblem] = useState<string | null>(null)
  const controller = useRef<AbortController | null>(null)
  // Whether a check is under way, read when a key is pressed twice quickly.
  const checkingNow = useRef(false)
  useEffect(() => () => controller.current?.abort(), [])
  const readiness = useAiReadiness('chat')

  const question = byId.get(shownId)!
  const answer = answerTo(attempt, shownId)
  const position = attempt.questionIds.indexOf(shownId)
  const total = attempt.questionIds.length

  function update(next: Attempt) {
    if (next === latest.current) return
    latest.current = next
    setAttempt(next)
    saveAttempt(quiz.id, next).catch((error: unknown) =>
      console.error('[momentum] A quiz answer could not be saved.', error),
    )
  }

  const onScreen = () => byId.get(shown.current)!

  function choose(index: number) {
    const current = onScreen()
    if (current.kind !== 'choice') return
    update(chooseAnswer(latest.current, current, index, timeNow()))
  }

  function submit(text: string) {
    const current = onScreen()
    if (current.kind !== 'short') return
    update(writeAnswer(latest.current, current, text, timeNow()))
  }

  function mark(value: Mark) {
    const current = onScreen()
    const given = answerTo(latest.current, current.id)
    if (current.kind !== 'short' || !given || given.markedBy === 'auto') return
    // Your own mark wins over a check still under way.
    controller.current?.abort()
    checkingNow.current = false
    setChecking(false)
    update(markAnswer(latest.current, current.id, value, 'self'))
  }

  async function check() {
    const current = onScreen()
    const given = answerTo(latest.current, current.id)
    if (
      current.kind !== 'short' ||
      !given ||
      given.markedBy === 'auto' ||
      !readiness.ready ||
      checkingNow.current
    )
      return
    checkingNow.current = true
    setChecking(true)
    setProgress(startReply())
    setCheckProblem(null)
    const asking = new AbortController()
    controller.current = asking
    try {
      const grade = await checkAnswer(current, given.text, {
        signal: asking.signal,
        onProgress: (phase) =>
          setProgress((latest) =>
            controller.current === asking ? { ...latest, phase } : latest,
          ),
      })
      if (asking.signal.aborted || shown.current !== current.id) return
      update(
        markAnswer(
          latest.current,
          current.id,
          grade.mark,
          'ai',
          grade.feedback,
        ),
      )
    } catch (error) {
      if (!asking.signal.aborted)
        setCheckProblem(
          isAiError(error)
            ? describeAiError(error)
            : error instanceof Error
              ? error.message
              : describeAiError(error),
        )
    } finally {
      if (controller.current === asking) {
        checkingNow.current = false
        setChecking(false)
      }
    }
  }

  function next() {
    if (!answerTo(latest.current, shown.current)?.mark) return
    controller.current?.abort()
    checkingNow.current = false
    setChecking(false)
    setCheckProblem(null)
    setWritten('')
    const at = currentIndex(latest.current)
    if (at === -1) {
      // The page shows the results once it's saved.
      update(finishAttempt(latest.current, timeNow()))
      return
    }
    shown.current = latest.current.questionIds[at]
    setShownId(shown.current)
  }

  function onNumber(number: number) {
    const current = onScreen()
    const given = answerTo(latest.current, current.id)
    if (!given) {
      if (current.kind === 'choice') choose(number - 1)
    } else if (current.kind === 'short' && number <= MARKS.length)
      mark(MARKS[number - 1].mark)
  }

  useHotkeys([
    ...[1, 2, 3, 4, 5, 6].map((number) => ({
      key: String(number),
      run: () => onNumber(number),
    })),
    { key: 'Enter', run: next },
    { key: ' ', run: next },
    { key: 'g', run: () => void check() },
  ])

  const isLast = currentIndex(attempt) === -1
  const marked = Boolean(answer?.mark)

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col">
      <div className="mb-4 flex items-center gap-3">
        <Link
          href={paths.quizzes}
          aria-label="Back to quizzes"
          className="flex size-10 shrink-0 items-center justify-center rounded-full glass text-lg transition hover:bg-tint"
        >
          <ArrowLeftIcon />
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-lg font-semibold tracking-tight text-shadow-soft">
            {quiz.title}
          </h1>
          <p className="text-xs text-fg-subtle tabular-nums" aria-live="polite">
            Question {position + 1} of {total}
          </p>
        </div>
        <button
          type="button"
          onClick={onDetails}
          aria-label="Quiz details"
          className="flex size-10 shrink-0 items-center justify-center rounded-full text-lg text-fg-muted transition hover:bg-tint hover:text-fg"
        >
          <MoreIcon />
        </button>
      </div>
      <div
        className="mb-4 h-1 overflow-hidden rounded-full bg-tint"
        role="progressbar"
        aria-label="Progress"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={position + (marked ? 1 : 0)}
      >
        <div
          className="h-full rounded-full bg-linear-to-r from-amber-300 to-orange-500 transition-[width]"
          style={{ width: `${((position + (marked ? 1 : 0)) / total) * 100}%` }}
        />
      </div>

      <article
        aria-label={`Question ${position + 1}`}
        className="flex flex-col rounded-[28px] glass-strong p-5 sm:p-8"
      >
        <p className="mb-4 text-[11px] font-semibold tracking-[0.18em] text-fg-subtle uppercase">
          {question.kind === 'choice' ? 'Multiple choice' : 'Short answer'}
        </p>
        <div className="text-lg sm:text-xl">
          <MarkdownView markdown={question.prompt} />
        </div>

        {question.kind === 'choice' ? (
          <Choices question={question} answer={answer} onChoose={choose} />
        ) : !answer ? (
          <div className="mt-6">
            <textarea
              key={question.id}
              value={written}
              onChange={(event) => setWritten(event.target.value)}
              onKeyDown={(event) => {
                if (
                  event.key === 'Enter' &&
                  !event.shiftKey &&
                  !event.nativeEvent.isComposing
                ) {
                  event.preventDefault()
                  if (written.trim()) submit(written)
                }
              }}
              rows={3}
              autoFocus
              aria-label="Your answer"
              placeholder="Your answer, in a sentence or two"
              className="block w-full resize-y rounded-2xl bg-tint px-4 py-3 text-[15px] outline-none placeholder:text-fg-subtle focus-visible:ring-2 focus-visible:ring-orange-300/60"
            />
            <p className="mt-2 text-xs text-fg-subtle">
              Enter to check it · Shift+Enter for a new line
            </p>
          </div>
        ) : (
          <ShortAnswer
            question={question}
            answer={answer}
            ai={
              readiness.ready
                ? {
                    provider:
                      readiness.entry?.name ??
                      PROVIDERS[readiness.provider].label,
                    local: PROVIDERS[readiness.provider].local,
                    checking,
                    progress,
                    problem: checkProblem,
                    onCheck: () => void check(),
                  }
                : null
            }
            onMark={mark}
          />
        )}

        {answer?.mark && (
          <Explanation question={question} answer={answer} quiz={quiz} />
        )}
      </article>

      <div className="sticky bottom-[calc(env(safe-area-inset-bottom)+5.5rem)] mt-4 lg:bottom-4">
        {marked ? (
          <button
            type="button"
            onClick={next}
            className={cn(primary, 'w-full rounded-[28px] px-6 py-4 text-base')}
          >
            {isLast ? 'See how you did' : 'Next question'}
            <span className="ml-2 hidden text-xs font-medium opacity-70 sm:inline">
              Enter
            </span>
          </button>
        ) : question.kind === 'short' && !answer ? (
          <div className="flex gap-2">
            <button
              type="button"
              disabled={!written.trim()}
              onClick={() => submit(written)}
              className={cn(
                primary,
                'flex-1 rounded-[28px] px-6 py-4 text-base',
              )}
            >
              Check answer
            </button>
            <button
              type="button"
              onClick={() => submit('')}
              className={cn(secondary, 'rounded-[28px] glass-strong px-5 py-4')}
            >
              I don’t know
            </button>
          </div>
        ) : null}
      </div>
    </div>
  )
}

function Choices({
  question,
  answer,
  onChoose,
}: {
  question: Extract<Question, { kind: 'choice' }>
  answer: Answer | undefined
  onChoose: (index: number) => void
}) {
  return (
    <ol className="mt-6 space-y-2" aria-label="Choices">
      {question.choices.map((choice, index) => {
        const right = index === question.answer
        const picked = answer?.choice === index
        const state = !answer
          ? 'open'
          : right
            ? 'right'
            : picked
              ? 'wrong'
              : 'other'
        return (
          <li key={index}>
            <button
              type="button"
              disabled={Boolean(answer)}
              onClick={() => onChoose(index)}
              aria-label={
                state === 'right'
                  ? `${choice} (the answer${picked ? ', your choice' : ''})`
                  : state === 'wrong'
                    ? `${choice} (your choice)`
                    : undefined
              }
              className={cn(
                'flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-[15px] transition',
                state === 'open' && 'bg-tint hover:bg-line active:scale-[0.99]',
                state === 'right' &&
                  'bg-emerald-400/15 ring-1 ring-emerald-300/50 light:bg-emerald-500/10',
                state === 'wrong' &&
                  'bg-rose-400/15 ring-1 ring-rose-300/50 light:bg-rose-500/10',
                state === 'other' && 'bg-tint opacity-60',
              )}
            >
              <span
                className={cn(
                  'flex size-6 shrink-0 items-center justify-center rounded-lg text-xs font-semibold tabular-nums',
                  state === 'right'
                    ? 'bg-emerald-400 text-emerald-950'
                    : state === 'wrong'
                      ? 'bg-rose-400 text-rose-950'
                      : 'bg-line text-fg-muted',
                )}
                aria-hidden="true"
              >
                {state === 'right' ? (
                  <CheckIcon />
                ) : state === 'wrong' ? (
                  <CloseIcon />
                ) : (
                  index + 1
                )}
              </span>
              <span className="min-w-0 flex-1">
                <MarkdownView markdown={choice} />
              </span>
            </button>
          </li>
        )
      })}
    </ol>
  )
}

function ShortAnswer({
  question,
  answer,
  ai,
  onMark,
}: {
  question: Extract<Question, { kind: 'short' }>
  answer: Answer
  ai: {
    provider: string
    /** The model on this device: nothing is sent. */
    local: boolean
    checking: boolean
    progress: ReplyProgress
    problem: string | null
    onCheck: () => void
  } | null
  onMark: (mark: Mark) => void
}) {
  const fixed = answer.markedBy === 'auto'
  return (
    <div className="mt-6 space-y-5">
      <div>
        <p className="text-[11px] font-semibold tracking-[0.18em] text-fg-subtle uppercase">
          Your answer
        </p>
        <p className="mt-1.5 text-[15px] whitespace-pre-wrap">
          {answer.text || (
            <span className="text-fg-subtle italic">You didn’t know.</span>
          )}
        </p>
      </div>
      <div className="rounded-2xl bg-tint p-4">
        <p className="text-[11px] font-semibold tracking-[0.18em] text-fg-subtle uppercase">
          Model answer
        </p>
        <div className="mt-1.5 text-[15px]">
          <MarkdownView markdown={question.answer} />
        </div>
        {question.points.length > 0 && (
          <>
            <p className="mt-3 text-xs font-medium text-fg-muted">
              A right answer includes
            </p>
            <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm text-fg-muted">
              {question.points.map((point) => (
                <li key={point}>{point}</li>
              ))}
            </ul>
          </>
        )}
      </div>
      {!fixed && (
        <div className="space-y-3">
          <p className="text-sm font-medium">How did you do?</p>
          <div
            role="group"
            aria-label="Mark your answer"
            className="grid grid-cols-3 gap-2"
          >
            {MARKS.map(({ mark, label, icon, tone }, index) => (
              <button
                key={mark}
                type="button"
                aria-pressed={answer.mark === mark}
                onClick={() => onMark(mark)}
                className={cn(
                  'flex flex-col items-center gap-0.5 rounded-2xl bg-tint px-2 py-2.5 transition hover:bg-line active:scale-[0.98]',
                  answer.mark === mark && 'ring-2 ring-orange-300/70',
                )}
              >
                <span
                  className={cn(
                    'flex items-center gap-1 text-sm font-semibold',
                    tone,
                  )}
                >
                  {icon} {label}
                </span>
                <span className="hidden text-[10px] text-fg-subtle sm:block">
                  {index + 1}
                </span>
              </button>
            ))}
          </div>
          {ai && (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <button
                type="button"
                disabled={ai.checking}
                onClick={ai.onCheck}
                className={secondary}
              >
                <SparkleIcon />
                {ai.checking ? 'Checking…' : 'Check with AI'}
                <span className="hidden text-xs font-medium opacity-60 sm:inline">
                  G
                </span>
              </button>
              {ai.checking ? (
                <ReplyStatus
                  since={ai.progress.since}
                  phase={ai.progress.phase}
                  className="text-xs"
                />
              ) : (
                <p className="text-xs text-fg-subtle">
                  {ai.local
                    ? 'The model on this device reads the question, the model answer and your answer: nothing is sent.'
                    : `Sends the question, the model answer and your answer to ${ai.provider}.`}
                </p>
              )}
            </div>
          )}
          {ai?.problem && (
            <p className="text-sm text-rose-300 light:text-rose-600">
              {ai.problem}
            </p>
          )}
        </div>
      )}
    </div>
  )
}

/** After an answer: whether it was right, why, and where to read it again. */
function Explanation({
  question,
  answer,
  quiz,
}: {
  question: Question
  answer: Answer
  quiz: Quiz
}) {
  const verdict = MARKS.find((each) => each.mark === answer.mark)!
  // Into view as it appears or changes: on a phone it would otherwise sit
  // under the Next button. ("nearest" would leave it there: browsers don't
  // count the scroll margin when deciding whether it's in view.)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const element = ref.current
    if (!element) return
    const margin = parseFloat(getComputedStyle(element).scrollMarginBottom) || 0
    const { bottom, height } = element.getBoundingClientRect()
    if (bottom + margin <= innerHeight) return
    element.scrollIntoView({
      block: height + margin > innerHeight ? 'start' : 'end',
      behavior: matchMedia('(prefers-reduced-motion: reduce)').matches
        ? 'auto'
        : 'smooth',
    })
  }, [answer.mark, answer.feedback])
  const heading =
    question.kind === 'choice'
      ? answer.mark === 'right'
        ? 'Right'
        : 'Not quite'
      : answer.markedBy === 'auto'
        ? 'Counted as wrong'
        : answer.markedBy === 'ai'
          ? `AI marked it ${verdict.label.toLowerCase()}`
          : `You marked it ${verdict.label.toLowerCase()}`
  return (
    <div
      ref={ref}
      className="mt-6 scroll-mt-4 scroll-mb-[calc(env(safe-area-inset-bottom)+11rem)] border-t border-line pt-5 lg:scroll-mb-28"
      aria-live="polite"
    >
      <p
        className={cn('flex items-center gap-1.5 font-semibold', verdict.tone)}
      >
        {verdict.icon} {heading}
      </p>
      {answer.feedback && (
        <p className="mt-2 text-[15px] text-fg-muted">{answer.feedback}</p>
      )}
      {question.explanation && (
        <div className="mt-2 text-[15px] text-fg-muted">
          <MarkdownView markdown={question.explanation} />
        </div>
      )}
      {question.source && (
        <p className="mt-3 flex min-w-0 items-center gap-2 text-xs text-fg-subtle">
          <span className="shrink-0">Read it again:</span>
          <SourceLink source={question.source} quiz={quiz} />
        </p>
      )}
    </div>
  )
}
