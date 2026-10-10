import { useState, type FormEvent, type ReactNode } from 'react'
import { Sheet } from '@/components/Sheet'
import { SubjectPicker } from '@/features/subjects'
import { addDays, isDateKey, type DateKey } from '@/lib/date'
import { useToday } from '@/lib/useToday'
import { addGoal, updateGoal } from '../actions'
import { MAX_GOAL_TITLE, MAX_MILESTONES, MAX_WHY } from '../goals'
import type { Goal } from '../types'
import { fieldClass, primary, quiet, sectionTitle, shortDate } from './ui'

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <p className={sectionTitle}>{label}</p>
      {children}
    </div>
  )
}

/** Writing a new goal, or changing a goal's title, reason, subject and day. */
export function GoalSheet({
  open,
  goal,
  onClose,
  onAdded,
}: {
  open: boolean
  /** The goal to change; a new one without it. */
  goal?: Goal
  onClose: () => void
  onAdded?: (goal: Goal) => void
}) {
  return (
    <Sheet open={open} onClose={onClose} title={goal ? 'Goal' : 'New goal'}>
      {open && (
        <GoalForm
          key={goal?.id ?? 'new'}
          goal={goal}
          onSaved={(saved) => {
            if (goal) onClose()
            else onAdded?.(saved)
          }}
        />
      )}
    </Sheet>
  )
}

function GoalForm({
  goal,
  onSaved,
}: {
  goal?: Goal
  onSaved: (goal: Goal) => void
}) {
  const today = useToday()
  const [title, setTitle] = useState(goal?.title ?? '')
  const [why, setWhy] = useState(goal?.why ?? '')
  const [subjectId, setSubjectId] = useState<string | null>(
    goal?.subjectId ?? null,
  )
  const [target, setTarget] = useState<DateKey | null>(goal?.target ?? null)
  const [milestones, setMilestones] = useState('')
  const [saving, setSaving] = useState(false)
  const steps = milestones
    .split('\n')
    .map((line) => line.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, '').trim())
    .filter(Boolean)

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!title.trim() || saving) return
    setSaving(true)
    if (goal) {
      await updateGoal(goal.id, { title, why, subjectId, target })
      onSaved(goal)
      return
    }
    const added = await addGoal({
      title,
      why,
      subjectId,
      target,
      milestones: steps,
    })
    setSaving(false)
    if (added) onSaved(added)
  }

  const quick: [string, DateKey][] = [
    ['In 4 weeks', addDays(today, 28)],
    ['In 3 months', addDays(today, 91)],
    ['End of the year', `${today.slice(0, 4)}-12-31`],
  ]

  return (
    <form onSubmit={(event) => void submit(event)} className="space-y-6 pt-1">
      <input
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        placeholder="A distinction in Calculus, a 10 km run…"
        aria-label="Goal"
        autoFocus={!goal}
        maxLength={MAX_GOAL_TITLE}
        className="w-full rounded-xl bg-tint px-3.5 py-3 text-base font-medium outline-none focus-visible:outline-2"
      />
      <Field label="Why it matters">
        <textarea
          value={why}
          onChange={(event) => setWhy(event.target.value)}
          placeholder="Optional: what reaching it will mean to you"
          aria-label="Why it matters"
          rows={3}
          maxLength={MAX_WHY}
          className="w-full resize-none rounded-xl bg-tint px-3.5 py-3 text-sm leading-relaxed outline-none focus-visible:outline-2"
        />
      </Field>
      <Field label="Reach it by">
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="date"
            value={target ?? ''}
            onChange={(event) =>
              setTarget(
                isDateKey(event.target.value) ? event.target.value : null,
              )
            }
            aria-label="Target date"
            className={`${fieldClass} min-w-0 flex-1`}
          />
          {target && (
            <button
              type="button"
              onClick={() => setTarget(null)}
              className={quiet}
            >
              No date
            </button>
          )}
        </div>
        {target ? (
          target < today && (
            <p className="text-xs text-fg-subtle">
              {shortDate(target, today)} has passed already.
            </p>
          )
        ) : (
          <div className="flex flex-wrap gap-2">
            {quick.map(([label, day]) => (
              <button
                key={label}
                type="button"
                onClick={() => setTarget(day)}
                className="rounded-full bg-tint px-3 py-1.5 text-xs font-semibold text-fg-muted transition hover:text-fg"
              >
                {label}
              </button>
            ))}
          </div>
        )}
      </Field>
      <Field label="Subject">
        <SubjectPicker
          value={subjectId}
          onChange={(id) =>
            setSubjectId((current) => (current === id ? null : id))
          }
        />
      </Field>
      {!goal && (
        <Field label="First milestones">
          <textarea
            value={milestones}
            onChange={(event) => setMilestones(event.target.value)}
            placeholder={
              'Optional, one a line:\nChapters 1–3 problems\nMidterm\nFinal exam'
            }
            aria-label="First milestones, one a line"
            rows={4}
            className="w-full resize-none rounded-xl bg-tint px-3.5 py-3 text-sm leading-relaxed outline-none focus-visible:outline-2"
          />
          {steps.length > MAX_MILESTONES && (
            <p className="text-xs text-fg-subtle">
              The first {MAX_MILESTONES} are kept.
            </p>
          )}
        </Field>
      )}
      <button
        type="submit"
        disabled={!title.trim() || saving}
        className={primary}
      >
        {goal ? 'Save' : 'Add goal'}
      </button>
    </form>
  )
}
