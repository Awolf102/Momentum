import { useEffect, useId, useRef, useState } from 'react'
import { GlassCard } from '@/components/GlassCard'
import {
  BookIcon,
  ChecklistIcon,
  GoalIcon,
  RepeatIcon,
  SparkleIcon,
  TimerIcon,
} from '@/components/icons'
import {
  describeAiError,
  isAiError,
  SendPreview,
  useAiReadiness,
} from '@/features/ai'
import { estimateTokens } from '@/features/ai/material'
import { formatDateKey, localDay } from '@/lib/date'
import { formatMinutes } from '@/lib/duration'
import { openSettings } from '@/lib/routes'
import { useStore } from '@/lib/store'
import type { WeekSummary } from '../lib/week'
import {
  REVIEW_PARTS,
  REVIEW_SYSTEM,
  reviewRequest,
  type ReviewPart,
} from '../lib/writeUp'
import { reviewStore } from '../store'
import { NoWriteUpError, writeUpWeek } from '../write'

const primary =
  'inline-flex items-center justify-center gap-1.5 rounded-full bg-linear-to-br from-amber-300 to-orange-500 px-4 py-2 text-sm font-semibold text-orange-950 transition active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40'

const plural = (count: number, one: string, many = `${one}s`) =>
  `${count} ${count === 1 ? one : many}`

/** The week written up by AI, kept; or the way to ask for it. */
export function WriteUpCard({ summary }: { summary: WeekSummary }) {
  const headingId = useId()
  const readiness = useAiReadiness('chat')
  const written = useStore(reviewStore).written[summary.start]
  const [previewing, setPreviewing] = useState(false)
  const [writing, setWriting] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const [retrying, setRetrying] = useState<string | null>(null)
  const [leftOut, setLeftOut] = useState<ReadonlySet<ReviewPart>>(new Set())
  const controller = useRef<AbortController | null>(null)
  useEffect(() => () => controller.current?.abort(), [])

  const parts = new Set(REVIEW_PARTS.filter((part) => !leftOut.has(part)))
  const { focus } = summary
  const items = (
    [
      [
        'focus',
        'Focus and check-ins',
        `${formatMinutes(focus.minutes)} over ${plural(focus.sessions, 'session')}, by day and by subject name, and ${plural(summary.checkIns, 'check-in')}`,
        <TimerIcon key="focus" />,
      ],
      ...(summary.habits.length
        ? [
            [
              'habits',
              'Habits',
              `${plural(summary.habits.length, 'habit')}, with ${summary.habits.length === 1 ? 'its name' : 'their names'} and days done`,
              <RepeatIcon key="habits" />,
            ] as const,
          ]
        : []),
      [
        'tasks',
        'Tasks',
        `${summary.tasksDone.length} finished and ${summary.stillOpen.length} still open, with their titles`,
        <ChecklistIcon key="tasks" />,
      ],
      ...(summary.milestones.length
        ? [
            [
              'goals',
              'Milestones',
              `${plural(summary.milestones.length, 'milestone')} reached, with ${summary.milestones.length === 1 ? 'its goal' : 'their goals'}`,
              <GoalIcon key="goals" />,
            ] as const,
          ]
        : []),
      ...(summary.log.length
        ? [
            [
              'log',
              'Log',
              `${plural(summary.log.length, 'line')}, word for word`,
              <BookIcon key="log" />,
            ] as const,
          ]
        : []),
    ] as const
  ).map(([id, title, detail, icon]) => ({ id, title, detail, icon }))

  async function write() {
    setPreviewing(false)
    setWriting(true)
    setProblem(null)
    setRetrying(null)
    controller.current = new AbortController()
    try {
      await writeUpWeek(summary, parts, {
        signal: controller.current.signal,
        onRetry: (info) =>
          setRetrying(
            `Busy, trying again in ${Math.max(1, Math.round(info.delayMs / 1000))} s`,
          ),
      })
    } catch (error) {
      if (!controller.current?.signal.aborted)
        setProblem(
          error instanceof NoWriteUpError
            ? error.message
            : isAiError(error)
              ? describeAiError(error)
              : 'Something went wrong. Try again in a moment.',
        )
    } finally {
      setWriting(false)
      setRetrying(null)
    }
  }

  return (
    <GlassCard aria-labelledby={headingId} className="p-5 sm:p-6">
      <h2
        id={headingId}
        className="flex items-center gap-2 text-xs font-semibold tracking-[0.14em] text-fg-subtle uppercase"
      >
        <SparkleIcon className="text-sm" />
        The week, written up
      </h2>
      {written && !writing ? (
        <div className="mt-3 space-y-4">
          {(
            [
              ['What went well', written.wentWell],
              ['What slipped', written.slipped],
              ['For next week', written.nextWeek],
            ] as const
          )
            .filter(([, text]) => text)
            .map(([title, text]) => (
              <section key={title}>
                <h3 className="text-sm font-semibold">{title}</h3>
                <p className="mt-1 text-[15px] leading-relaxed text-fg-muted">
                  {text}
                </p>
              </section>
            ))}
          <p className="text-xs text-fg-subtle">
            Written by AI from what you shared, on{' '}
            {formatDateKey(localDay(written.at), {
              weekday: 'short',
              day: 'numeric',
              month: 'short',
            })}
            .{' '}
            {readiness.ready && (
              <button
                type="button"
                onClick={() => setPreviewing(true)}
                className="font-semibold text-fg-muted underline-offset-2 hover:text-fg hover:underline"
              >
                Write it again
              </button>
            )}
          </p>
        </div>
      ) : (
        <div className="mt-2 space-y-3">
          <p className="text-sm leading-relaxed text-fg-muted">
            AI can write the week up: what went well, what slipped, and an idea
            for next week. You choose what it’s sent, and the write-up stays
            here.
          </p>
          {readiness.ready ? (
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => setPreviewing(true)}
                disabled={writing}
                className={primary}
              >
                <SparkleIcon />
                {writing ? 'Writing it up…' : 'Write it up'}
              </button>
              {writing && (
                <button
                  type="button"
                  onClick={() => controller.current?.abort()}
                  className="text-sm font-medium text-fg-muted hover:text-fg"
                >
                  Stop
                </button>
              )}
            </div>
          ) : (
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
      )}
      {retrying && (
        <p role="status" className="mt-2 text-xs text-fg-subtle">
          {retrying}
        </p>
      )}
      {problem && (
        <p
          role="alert"
          className="mt-2 text-sm text-rose-300 light:text-rose-600"
        >
          {problem}
        </p>
      )}
      {readiness.ready && (
        <SendPreview
          open={previewing}
          onClose={() => setPreviewing(false)}
          title="Write up the week"
          purpose={
            <>
              To write up the week of{' '}
              {formatDateKey(summary.start, { day: 'numeric', month: 'long' })},
              what’s ticked below is sent with instructions to review it: what
              went well, what slipped, and an idea for next week. The write-up
              is kept on this device.
            </>
          }
          provider={readiness.provider}
          model={readiness.model}
          items={items}
          skipped={leftOut}
          onToggle={(id, send) =>
            setLeftOut((set) => {
              const next = new Set(set)
              if (send) next.delete(id as ReviewPart)
              else next.add(id as ReviewPart)
              return next
            })
          }
          tokens={estimateTokens(
            REVIEW_SYSTEM.length + reviewRequest(summary, parts).length,
          )}
          sendLabel="Send"
          onSend={() => void write()}
        />
      )}
    </GlassCard>
  )
}
