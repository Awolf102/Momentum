import { useState, type FormEvent, type ReactNode } from 'react'
import { TrashIcon } from '@/components/icons'
import { SegmentedControl } from '@/components/SegmentedControl'
import { Sheet } from '@/components/Sheet'
import { SubjectPicker } from '@/features/subjects'
import type { DateKey } from '@/lib/date'
import { DAY_MINUTES, formatLength, MIN_BLOCK, parseClock } from '../lib/time'
import type { Block } from '../types'

const fieldClass =
  'h-10 rounded-xl bg-tint px-3 text-sm outline-none focus-visible:outline-2'
const primary =
  'inline-flex items-center justify-center rounded-full bg-linear-to-br from-amber-300 to-orange-500 px-5 py-2 text-sm font-semibold text-orange-950 transition active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40'
const secondary =
  'inline-flex items-center justify-center gap-1.5 rounded-full bg-tint px-4 py-2 text-sm font-semibold transition hover:bg-line'

/** What the sheet is for: a block to change, or a new one at a time. */
export type Editing =
  { block: Block } | { draft: { day: DateKey; start: number; end: number } }

export interface BlockFields {
  kind: 'focus' | 'other'
  title: string
  subjectId: string | null
  start: number
  end: number
}

const clock = (minutes: number) =>
  `${String(Math.floor((minutes % DAY_MINUTES) / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold tracking-[0.14em] text-fg-subtle uppercase">
        {label}
      </p>
      {children}
    </div>
  )
}

interface BlockSheetProps {
  editing: Editing | null
  onClose: () => void
  /** A task block's task, by title. */
  taskTitle: (block: Block) => string | null
  onSave: (fields: BlockFields) => void
  onRemove: (block: Block) => void
}

/** Adding a block at a time, or changing one: what it's for, and when. */
export function BlockSheet({
  editing,
  onClose,
  taskTitle,
  onSave,
  onRemove,
}: BlockSheetProps) {
  const key = editing
    ? 'block' in editing
      ? editing.block.id
      : `new:${editing.draft.start}`
    : 'none'
  return (
    <Sheet
      open={editing !== null}
      onClose={onClose}
      title={editing && 'block' in editing ? 'Block' : 'New block'}
    >
      {editing && (
        <BlockForm
          key={key}
          editing={editing}
          taskTitle={taskTitle}
          onSave={(fields) => {
            onSave(fields)
            onClose()
          }}
          onRemove={(block) => {
            onRemove(block)
            onClose()
          }}
        />
      )}
    </Sheet>
  )
}

function BlockForm({
  editing,
  taskTitle,
  onSave,
  onRemove,
}: {
  editing: Editing
  taskTitle: (block: Block) => string | null
  onSave: (fields: BlockFields) => void
  onRemove: (block: Block) => void
}) {
  const block = 'block' in editing ? editing.block : null
  const initial =
    'block' in editing
      ? editing.block
      : {
          ...editing.draft,
          kind: 'focus' as const,
          title: '',
          subjectId: null as string | null,
        }
  const [kind, setKind] = useState<'focus' | 'other'>(
    initial.kind === 'other' ? 'other' : 'focus',
  )
  const [title, setTitle] = useState(initial.title)
  const [subjectId, setSubjectId] = useState<string | null>(initial.subjectId)
  const [start, setStart] = useState(clock(initial.start))
  const [end, setEnd] = useState(clock(initial.end))
  const task = block?.kind === 'task' ? taskTitle(block) : null

  const from = parseClock(start)
  let to = parseClock(end)
  // Midnight as an end is the end of the day.
  if (to === 0 && from !== null && from > 0) to = DAY_MINUTES
  const problem =
    from === null || to === null
      ? 'Choose when it starts and ends.'
      : to - from < MIN_BLOCK
        ? to <= from
          ? 'It ends before it starts.'
          : `A block is at least ${MIN_BLOCK} minutes.`
        : null

  function submit(event: FormEvent) {
    event.preventDefault()
    if (problem || from === null || to === null) return
    onSave({
      kind: block?.kind === 'task' ? 'other' : kind,
      title: title.trim(),
      subjectId,
      start: from,
      end: to,
    })
  }

  return (
    <form onSubmit={submit} className="space-y-6 pt-1">
      {block?.kind === 'task' ? (
        <Field label="Task">
          <p className="rounded-xl bg-tint px-3.5 py-3 text-base font-medium">
            {task ?? block.title}
          </p>
        </Field>
      ) : (
        <>
          {!block && (
            <SegmentedControl<'focus' | 'other'>
              label="Kind of block"
              value={kind}
              options={[
                { value: 'focus', label: 'Focus' },
                { value: 'other', label: 'Something else' },
              ]}
              onChange={setKind}
            />
          )}
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder={
              kind === 'focus'
                ? 'What you’ll work on (optional)'
                : 'Gym, lunch, travel…'
            }
            aria-label="Title"
            autoFocus={!block}
            maxLength={200}
            className="w-full rounded-xl bg-tint px-3.5 py-3 text-base font-medium outline-none focus-visible:outline-2"
          />
        </>
      )}
      <Field label="When">
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="time"
            step={900}
            value={start}
            onChange={(event) => setStart(event.target.value)}
            aria-label="Starts"
            className={`${fieldClass} w-32`}
          />
          <span className="text-fg-subtle">to</span>
          <input
            type="time"
            step={900}
            value={end}
            onChange={(event) => setEnd(event.target.value)}
            aria-label="Ends"
            className={`${fieldClass} w-32`}
          />
          {!problem && from !== null && to !== null && (
            <span className="text-sm text-fg-muted">
              {formatLength(to - from)}
            </span>
          )}
        </div>
        {problem && (
          <p role="alert" className="text-sm text-rose-300 light:text-rose-600">
            {problem}
          </p>
        )}
      </Field>
      {block?.kind !== 'task' && (
        <Field label="Subject">
          <SubjectPicker
            value={subjectId}
            onChange={(id) =>
              setSubjectId((current) => (current === id ? null : id))
            }
          />
        </Field>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <button type="submit" disabled={problem !== null} className={primary}>
          {block ? 'Save' : 'Add to the plan'}
        </button>
        {block && (
          <button
            type="button"
            onClick={() => onRemove(block)}
            className={`${secondary} text-rose-300 light:text-rose-600`}
          >
            <TrashIcon /> Remove from the plan
          </button>
        )}
      </div>
    </form>
  )
}
