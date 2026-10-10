import { useState } from 'react'
import { ActionRow } from '@/components/ActionRow'
import { StopIcon, TrashIcon } from '@/components/icons'
import { Sheet } from '@/components/Sheet'
import { SubjectPicker } from '@/features/subjects'
import { formatDateKey, toDateKey } from '@/lib/date'
import { toast } from '@/lib/toast'
import {
  deleteQuiz,
  openAttempt,
  restoreQuiz,
  saveAttempt,
  stopAttempt,
  updateQuiz,
} from '../actions'
import { MAX_TITLE } from '../lib/limits'
import { describePages } from '../lib/pages'
import type { Quiz } from '../types'
import { SourceLink } from './parts'
import { plural } from './ui'

/** A quiz's name, subject and what it was made from, and deleting it. */
export function QuizSheet({
  quiz,
  open,
  onClose,
}: {
  quiz: Quiz
  open: boolean
  onClose: () => void
}) {
  return (
    <Sheet open={open} onClose={onClose} title="Quiz">
      <Details key={quiz.id} quiz={quiz} onClose={onClose} />
    </Sheet>
  )
}

function Details({ quiz, onClose }: { quiz: Quiz; onClose: () => void }) {
  const [title, setTitle] = useState(quiz.title)
  const made = formatDateKey(toDateKey(new Date(quiz.createdAt)), {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
  const goes = quiz.attempts.filter((attempt) => attempt.finishedAt).length

  function remove() {
    onClose()
    // Gone from the list at once (the page goes back to it), so the toast
    // doesn't wait for the write either.
    void deleteQuiz(quiz.id)
    toast({
      title: 'Quiz deleted',
      action: { label: 'Undo', run: () => void restoreQuiz(quiz.id) },
    })
  }

  async function stop() {
    onClose()
    const stopped = await stopAttempt(quiz.id)
    if (stopped)
      toast({
        title: 'Stopped',
        action: {
          label: 'Undo',
          run: () => void saveAttempt(quiz.id, stopped),
        },
      })
  }

  return (
    <div className="space-y-6">
      <label className="block space-y-2">
        <span className="text-xs font-semibold tracking-[0.14em] text-fg-subtle uppercase">
          Title
        </span>
        <input
          value={title}
          maxLength={MAX_TITLE}
          onChange={(event) => setTitle(event.target.value)}
          onBlur={() => {
            void updateQuiz(quiz.id, { title })
            setTitle((value) => value.trim() || quiz.title)
          }}
          onKeyDown={(event) =>
            event.key === 'Enter' && event.currentTarget.blur()
          }
          className="h-11 w-full rounded-xl bg-tint px-3 text-[15px] outline-none focus-visible:outline-2"
        />
      </label>
      <div className="space-y-2">
        <p className="text-xs font-semibold tracking-[0.14em] text-fg-subtle uppercase">
          Subject
        </p>
        <SubjectPicker
          value={quiz.subjectId}
          onChange={(subjectId) =>
            void updateQuiz(quiz.id, {
              // Tapping the chosen subject again clears it.
              subjectId: subjectId === quiz.subjectId ? null : subjectId,
            })
          }
        />
      </div>
      <div className="space-y-2">
        <p className="text-xs font-semibold tracking-[0.14em] text-fg-subtle uppercase">
          Made from
        </p>
        <ul className="space-y-1.5">
          {quiz.sources.map((source) => (
            <li key={`${source.kind}:${source.id}`} className="text-sm">
              <SourceLink
                source={{ kind: source.kind, id: source.id, page: null }}
                quiz={quiz}
              />
              {source.pages && (
                <span className="ml-5 block text-xs text-fg-subtle">
                  {describePages(source.pages, null)}
                </span>
              )}
            </li>
          ))}
        </ul>
      </div>
      <p className="text-sm leading-relaxed text-fg-muted">
        {plural(quiz.questions.length, 'question')}, made {made}.{' '}
        {goes
          ? `Taken ${goes === 1 ? 'once' : `${goes} times`}.`
          : 'Not finished yet.'}
      </p>
      <div className="space-y-2">
        {openAttempt(quiz) && (
          <ActionRow
            icon={<StopIcon />}
            label="Stop this go"
            hint="Its answers are dropped"
            onClick={() => void stop()}
          />
        )}
        <ActionRow
          icon={<TrashIcon />}
          label="Delete quiz"
          onClick={remove}
          danger
        />
      </div>
    </div>
  )
}
