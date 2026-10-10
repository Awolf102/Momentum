import { SparkleIcon } from '@/components/icons'
import { cn } from '@/lib/cn'
import { openSettings } from '@/lib/routes'
import type { BlockShape } from '../hooks/usePlanDay'
import type { usePlanMyDay } from '../hooks/usePlanMyDay'
import { DAY_MINUTES, formatClock, MIN_BLOCK, parseClock } from '../lib/time'
import { changeDraft, type DraftOnPlan } from '../planMyDay'

type PlanMyDayState = ReturnType<typeof usePlanMyDay>

const primary =
  'inline-flex items-center justify-center gap-1.5 rounded-full bg-linear-to-br from-amber-300 to-orange-500 px-4 py-2 text-sm font-semibold text-orange-950 transition active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40'
const secondary =
  'inline-flex items-center justify-center gap-1.5 rounded-full bg-tint px-4 py-2 text-sm font-semibold transition hover:bg-line'

const clock = (minutes: number) =>
  `${String(Math.floor((minutes % DAY_MINUTES) / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`

/**
 * "Plan my day" before there's a draft: what it does, the button, and why
 * it can't run (no chat model, a day that's over).
 */
export function PlanMyDayStart({ planner }: { planner: PlanMyDayState }) {
  const { readiness, window, drafting, problem, retrying } = planner
  return (
    <div className="space-y-3">
      <p className="text-sm leading-relaxed text-fg-muted">
        AI drafts the day from your tasks, deadlines and calendar. You choose
        what to keep.
      </p>
      {!readiness.ready ? (
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
      ) : !window ? (
        <p className="text-sm text-fg-muted">
          There’s no time left to plan on this day.
        </p>
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={planner.open}
            disabled={drafting}
            className={primary}
          >
            <SparkleIcon />
            {drafting ? 'Drafting your day…' : 'Plan my day'}
          </button>
          {drafting && (
            <button
              type="button"
              onClick={planner.stop}
              className="text-sm font-medium text-fg-muted hover:text-fg"
            >
              Stop
            </button>
          )}
          {!drafting && (
            <p className="text-xs text-fg-subtle tabular-nums">
              {formatClock(window.from)}–{formatClock(window.until)}
            </p>
          )}
        </div>
      )}
      {retrying && (
        <p role="status" className="text-xs text-fg-subtle">
          {retrying}
        </p>
      )}
      {problem && (
        <p role="alert" className="text-sm text-rose-300 light:text-rose-600">
          {problem}
        </p>
      )}
    </div>
  )
}

/** A draft to look over: keep or leave out each block, change it, then add them. */
export function DraftList({
  draft,
  titleOf,
  colorOf,
  onAdd,
  onDiscard,
}: {
  draft: DraftOnPlan
  titleOf: (block: BlockShape) => string
  colorOf: (block: BlockShape) => string
  onAdd: () => void
  onDiscard: () => void
}) {
  const kept = draft.blocks.filter((block) => block.keep).length
  return (
    <div className="space-y-3">
      {draft.note && (
        <p className="border-l-2 border-orange-300/60 pl-3 text-sm leading-relaxed text-fg-muted">
          {draft.note}
        </p>
      )}
      <ul aria-label="Suggested blocks" className="space-y-2">
        {draft.blocks.map((block) => {
          const title = titleOf(block)
          return (
            <li
              key={block.key}
              className={cn(
                'rounded-2xl bg-tint p-2.5 transition',
                !block.keep && 'opacity-55',
              )}
            >
              <div className="flex items-start gap-2.5">
                <input
                  type="checkbox"
                  checked={block.keep}
                  onChange={(event) =>
                    changeDraft(block.key, { keep: event.target.checked })
                  }
                  aria-label={`Keep: ${title}`}
                  className="mt-1 size-4 shrink-0 accent-orange-400"
                />
                <span
                  className="mt-1.5 size-2 shrink-0 rounded-full"
                  style={{ background: colorOf(block) }}
                />
                <div className="min-w-0 flex-1 space-y-1.5">
                  {block.kind === 'task' ? (
                    <p className="text-sm font-semibold break-words">{title}</p>
                  ) : (
                    <input
                      value={block.title}
                      onChange={(event) =>
                        changeDraft(block.key, { title: event.target.value })
                      }
                      placeholder={title}
                      aria-label="Title"
                      maxLength={200}
                      className="w-full rounded-lg bg-transparent text-sm font-semibold outline-none placeholder:text-fg focus-visible:bg-tint focus-visible:px-1.5"
                    />
                  )}
                  <div className="flex items-center gap-1.5 text-xs text-fg-muted">
                    <input
                      type="time"
                      step={900}
                      value={clock(block.start)}
                      onChange={(event) => {
                        // A new start moves it, keeping its length.
                        const start = parseClock(event.target.value)
                        if (start === null) return
                        const length = block.end - block.start
                        const from = Math.min(DAY_MINUTES - length, start)
                        changeDraft(block.key, {
                          start: from,
                          end: from + length,
                        })
                      }}
                      aria-label={`Starts: ${title}`}
                      className="h-7 rounded-lg bg-tint px-1.5 tabular-nums outline-none focus-visible:outline-2"
                    />
                    <span>to</span>
                    <input
                      type="time"
                      step={900}
                      value={clock(block.end)}
                      onChange={(event) => {
                        // A new end stretches it (midnight is the day's end).
                        let end = parseClock(event.target.value)
                        if (end === 0) end = DAY_MINUTES
                        if (end === null || end - block.start < MIN_BLOCK)
                          return
                        changeDraft(block.key, { end })
                      }}
                      aria-label={`Ends: ${title}`}
                      className="h-7 rounded-lg bg-tint px-1.5 tabular-nums outline-none focus-visible:outline-2"
                    />
                  </div>
                  {block.why && (
                    <p className="text-xs text-fg-subtle">{block.why}</p>
                  )}
                </div>
              </div>
            </li>
          )
        })}
      </ul>
      {draft.dropped > 0 && (
        <p className="text-xs text-fg-subtle">
          {draft.dropped === 1
            ? 'One suggestion didn’t fit (over something already on, or outside the time) and was left out.'
            : `${draft.dropped} suggestions didn’t fit (over something already on, or outside the time) and were left out.`}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onAdd}
          disabled={kept === 0}
          className={primary}
        >
          Add {kept} to the plan
        </button>
        <button type="button" onClick={onDiscard} className={secondary}>
          Discard
        </button>
      </div>
    </div>
  )
}
