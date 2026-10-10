import { motion } from 'motion/react'
import { useId, useState, type FormEvent, type ReactNode } from 'react'
import { GlassCard } from '@/components/GlassCard'
import {
  CheckIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  PlusIcon,
  TrashIcon,
} from '@/components/icons'
import { cn } from '@/lib/cn'
import { isDateKey, toDateKey, type DateKey } from '@/lib/date'
import { toast } from '@/lib/toast'
import { useToday } from '@/lib/useToday'
import {
  addMilestone,
  moveMilestone,
  removeMilestone,
  restoreMilestone,
  toggleMilestone,
  updateMilestone,
} from '../actions'
import { MAX_MILESTONE_TITLE, MAX_MILESTONES } from '../goals'
import type { Goal, Milestone } from '../types'
import {
  dueLabel,
  fieldClass,
  quiet,
  secondary,
  sectionTitle,
  shortDate,
} from './ui'

/** The big steps on the way, in order: tick them off, change or reorder them. */
export function Milestones({ goal }: { goal: Goal }) {
  const headingId = useId()
  const [editing, setEditing] = useState<string | null>(null)
  const done = goal.milestones.filter((milestone) => milestone.doneAt).length
  const closed = goal.status !== 'active'

  return (
    <GlassCard aria-labelledby={headingId} className="p-5 sm:p-6">
      <h2
        id={headingId}
        className={cn(sectionTitle, 'flex items-center gap-2')}
      >
        Milestones
        {goal.milestones.length > 0 && (
          <span className="font-medium tracking-normal normal-case tabular-nums">
            {done} of {goal.milestones.length}
          </span>
        )}
      </h2>
      {goal.milestones.length === 0 ? (
        <p className="mt-2 text-sm leading-relaxed text-fg-muted">
          The big steps on the way: chapters finished, an exam sat, a distance
          run. Give them a day if they have one.
        </p>
      ) : (
        <ol className="mt-2 divide-y divide-line" aria-label="Milestones">
          {goal.milestones.map((milestone, index) =>
            editing === milestone.id ? (
              <MilestoneEditor
                key={milestone.id}
                goal={goal}
                milestone={milestone}
                index={index}
                onDone={() => setEditing(null)}
              />
            ) : (
              <MilestoneRow
                key={milestone.id}
                goal={goal}
                milestone={milestone}
                onEdit={() => setEditing(milestone.id)}
              />
            ),
          )}
        </ol>
      )}
      {!closed &&
        (goal.milestones.length < MAX_MILESTONES ? (
          <AddMilestone goal={goal} />
        ) : (
          <p className="mt-3 text-xs text-fg-subtle">
            That’s the most a goal can have ({MAX_MILESTONES}).
          </p>
        ))}
    </GlassCard>
  )
}

function MilestoneRow({
  goal,
  milestone,
  onEdit,
}: {
  goal: Goal
  milestone: Milestone
  onEdit: () => void
}) {
  const today = useToday()
  const done = Boolean(milestone.doneAt)
  const overdue = !done && milestone.due !== null && milestone.due < today
  return (
    <li className="flex items-start gap-3 py-2.5">
      <button
        type="button"
        role="checkbox"
        aria-checked={done}
        aria-label={milestone.title}
        onClick={() => void toggleMilestone(goal.id, milestone.id)}
        className={cn(
          'mt-0.5 grid size-[1.375rem] shrink-0 place-items-center rounded-full ring-[1.5px] transition hover:bg-tint',
          done
            ? 'bg-orange-400 text-orange-950 ring-orange-400'
            : 'ring-fg-subtle',
        )}
      >
        {done && (
          <motion.span
            initial={{ scale: 0.4, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 520, damping: 22 }}
          >
            <CheckIcon strokeWidth={3} className="text-xs" />
          </motion.span>
        )}
      </button>
      <button
        type="button"
        onClick={onEdit}
        title="Change this milestone"
        className="min-w-0 flex-1 rounded-lg text-left"
      >
        <span
          className={cn(
            'block text-[15px] leading-snug break-words',
            done && 'text-fg-subtle line-through decoration-fg-subtle/50',
          )}
        >
          {milestone.title}
        </span>
        {(done || milestone.due) && (
          <span
            className={cn(
              'mt-0.5 block text-xs text-fg-subtle',
              overdue && 'text-rose-300 light:text-rose-600',
            )}
          >
            {done
              ? `Done ${shortDate(toDateKey(new Date(milestone.doneAt!)), today)}`
              : dueLabel(milestone.due!, today)}
          </span>
        )}
      </button>
    </li>
  )
}

/** A milestone opened to change: its title and day, its place, or remove it. */
function MilestoneEditor({
  goal,
  milestone,
  index,
  onDone,
}: {
  goal: Goal
  milestone: Milestone
  index: number
  onDone: () => void
}) {
  const [title, setTitle] = useState(milestone.title)
  const [due, setDue] = useState<DateKey | null>(milestone.due)

  async function save(event: FormEvent) {
    event.preventDefault()
    await updateMilestone(goal.id, milestone.id, { title, due })
    onDone()
  }

  async function remove() {
    const removed = await removeMilestone(goal.id, milestone.id)
    onDone()
    if (!removed) return
    toast({
      id: `milestone-removed-${milestone.id}`,
      icon: <TrashIcon />,
      title: 'Milestone removed',
      description: milestone.title,
      action: {
        label: 'Undo',
        run: () =>
          void restoreMilestone(goal.id, removed.milestone, removed.index),
      },
    })
  }

  return (
    <li className="py-3">
      <form
        onSubmit={(event) => void save(event)}
        className="space-y-2.5"
        aria-label={`Change “${milestone.title}”`}
      >
        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              event.preventDefault()
              event.stopPropagation()
              onDone()
            }
          }}
          autoFocus
          maxLength={MAX_MILESTONE_TITLE}
          aria-label="Milestone"
          className="w-full rounded-xl bg-tint px-3.5 py-2.5 text-[15px] outline-none focus-visible:outline-2"
        />
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="date"
            value={due ?? ''}
            onChange={(event) =>
              setDue(isDateKey(event.target.value) ? event.target.value : null)
            }
            aria-label="Milestone date"
            className={`${fieldClass} w-40`}
          />
          {due && (
            <button
              type="button"
              onClick={() => setDue(null)}
              className={quiet}
            >
              No date
            </button>
          )}
          <span className="flex-1" />
          <SmallButton
            label="Move up"
            disabled={index === 0}
            onClick={() => void moveMilestone(goal.id, milestone.id, -1)}
          >
            <ChevronUpIcon />
          </SmallButton>
          <SmallButton
            label="Move down"
            disabled={index === goal.milestones.length - 1}
            onClick={() => void moveMilestone(goal.id, milestone.id, 1)}
          >
            <ChevronDownIcon />
          </SmallButton>
          <SmallButton
            label="Remove milestone"
            onClick={() => void remove()}
            className="text-rose-300 light:text-rose-600"
          >
            <TrashIcon />
          </SmallButton>
        </div>
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={!title.trim()}
            className={cn(secondary, 'bg-orange-400/20 hover:bg-orange-400/30')}
          >
            Save
          </button>
          <button type="button" onClick={onDone} className={secondary}>
            Cancel
          </button>
        </div>
      </form>
    </li>
  )
}

function SmallButton({
  label,
  disabled = false,
  onClick,
  className,
  children,
}: {
  label: string
  disabled?: boolean
  onClick: () => void
  className?: string
  children: ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'grid size-9 place-items-center rounded-full bg-tint text-base transition hover:bg-line disabled:opacity-30',
        className,
      )}
    >
      {children}
    </button>
  )
}

/** Adds a milestone at the end, with a day if it has one. */
function AddMilestone({ goal }: { goal: Goal }) {
  const [title, setTitle] = useState('')
  const [due, setDue] = useState<DateKey | null>(null)

  async function add(event: FormEvent) {
    event.preventDefault()
    if (!title.trim()) return
    const added = await addMilestone(goal.id, title, due)
    if (!added) return
    setTitle('')
    setDue(null)
  }

  return (
    <form
      onSubmit={(event) => void add(event)}
      className="mt-3 flex flex-wrap items-center gap-2 rounded-2xl bg-tint py-1 pr-1 pl-3.5 ring-1 ring-transparent transition focus-within:ring-orange-300/50"
    >
      <PlusIcon className="shrink-0 text-base text-fg-subtle" />
      <input
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        placeholder="Add a milestone"
        aria-label="New milestone"
        enterKeyHint="done"
        maxLength={MAX_MILESTONE_TITLE}
        className="h-10 min-w-0 flex-1 basis-40 bg-transparent text-[15px] outline-none placeholder:text-fg-subtle focus-visible:outline-none"
      />
      <input
        type="date"
        value={due ?? ''}
        onChange={(event) =>
          setDue(isDateKey(event.target.value) ? event.target.value : null)
        }
        aria-label="New milestone’s date"
        className="h-9 w-36 rounded-xl bg-line/40 px-2.5 text-xs text-fg-muted outline-none focus-visible:outline-2"
      />
      <button
        type="submit"
        disabled={!title.trim()}
        className="rounded-xl bg-linear-to-br from-amber-300 to-orange-500 px-3.5 py-2 text-xs font-semibold text-orange-950 transition disabled:opacity-0"
      >
        Add
      </button>
    </form>
  )
}
