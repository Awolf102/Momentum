import { useState, type ReactNode } from 'react'
import { ActionRow } from '@/components/ActionRow'
import { TrashIcon } from '@/components/icons'
import { SegmentedControl } from '@/components/SegmentedControl'
import { Sheet } from '@/components/Sheet'
import { SubjectPicker } from '@/features/subjects'
import { addDays, formatDateKey, isDateKey, type DateKey } from '@/lib/date'
import { useStore } from '@/lib/store'
import { useToday } from '@/lib/useToday'
import { useTasks } from '../hooks/useTasks'
import { PRIORITY_NAMES } from '../lib/format'
import { describeRecurrence } from '../lib/recurrence'
import { closeTaskEditor, editingTaskStore } from '../store'
import { deleteTask, moveTask, updateTask } from '../tasks'
import type { Priority, Recurrence, Task, TaskStatus } from '../types'

/** Editing a task, opened by tapping it anywhere. */
export function TaskSheet() {
  const id = useStore(editingTaskStore)
  const task = useTasks().find((item) => item.id === id)
  return (
    <Sheet open={Boolean(task)} onClose={closeTaskEditor} title="Task">
      {task && <TaskEditor key={task.id} task={task} />}
    </Sheet>
  )
}

type RepeatChoice =
  | 'none'
  | 'day'
  | 'weekday'
  | 'week'
  | 'fortnight'
  | 'month'
  | 'year'
  | 'custom'

const REPEAT_CHOICES: [Exclude<RepeatChoice, 'custom'>, string][] = [
  ['none', "Doesn't repeat"],
  ['day', 'Every day'],
  ['weekday', 'Every weekday'],
  ['week', 'Every week'],
  ['fortnight', 'Every 2 weeks'],
  ['month', 'Every month'],
  ['year', 'Every year'],
]

function choiceOf(rule: Recurrence | null): RepeatChoice {
  if (!rule) return 'none'
  const days = rule.weekdays.join(',')
  if (rule.unit === 'day' && rule.interval === 1) return 'day'
  if (rule.unit === 'week' && rule.interval === 1 && days === '1,2,3,4,5')
    return 'weekday'
  if (rule.unit === 'week' && !days)
    return rule.interval === 1
      ? 'week'
      : rule.interval === 2
        ? 'fortnight'
        : 'custom'
  if (rule.unit === 'month' && rule.interval === 1) return 'month'
  if (rule.unit === 'year' && rule.interval === 1) return 'year'
  return 'custom'
}

function ruleFor(choice: RepeatChoice, due: DateKey): Recurrence | null {
  const base: Omit<Recurrence, 'unit'> = {
    interval: 1,
    weekdays: [],
    anchor: due,
  }
  switch (choice) {
    case 'day':
      return { ...base, unit: 'day' }
    case 'weekday':
      return { ...base, unit: 'week', weekdays: [1, 2, 3, 4, 5] }
    case 'week':
      return { ...base, unit: 'week' }
    case 'fortnight':
      return { ...base, unit: 'week', interval: 2 }
    case 'month':
      return { ...base, unit: 'month' }
    case 'year':
      return { ...base, unit: 'year' }
    default:
      return null
  }
}

const fieldClass =
  'h-10 rounded-xl bg-tint px-3 text-sm outline-none focus-visible:outline-2 disabled:opacity-50'

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

function TaskEditor({ task }: { task: Task }) {
  const today = useToday()
  const [title, setTitle] = useState(task.title)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const choice = choiceOf(task.recurrence)
  const saveTitle = () => {
    if (title.trim() && title !== task.title)
      void updateTask(task.id, { title })
    else setTitle(task.title)
  }

  return (
    <div className="space-y-6 pt-1">
      <input
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        onBlur={saveTitle}
        onKeyDown={(event) => {
          if (event.key === 'Enter') event.currentTarget.blur()
        }}
        aria-label="Title"
        className="w-full rounded-xl bg-tint px-3.5 py-3 text-base font-medium outline-none focus-visible:outline-2"
      />

      <Field label="Column">
        <SegmentedControl<TaskStatus>
          label="Column"
          value={task.status}
          options={[
            { value: 'todo', label: 'To do' },
            { value: 'doing', label: 'Doing' },
            { value: 'done', label: 'Done' },
          ]}
          onChange={(status) => void moveTask(task.id, status, null)}
        />
      </Field>

      <Field label="When">
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="date"
            value={task.due ?? ''}
            onChange={(event) =>
              void updateTask(task.id, {
                due: isDateKey(event.target.value) ? event.target.value : null,
              })
            }
            aria-label="Due date"
            className={`${fieldClass} min-w-0 flex-1`}
          />
          <input
            type="time"
            value={task.time ?? ''}
            disabled={!task.due}
            onChange={(event) =>
              void updateTask(task.id, { time: event.target.value || null })
            }
            aria-label="Time"
            className={`${fieldClass} w-32`}
          />
          {task.due && (
            <button
              type="button"
              onClick={() => void updateTask(task.id, { due: null })}
              className="rounded-full px-3 py-2 text-xs font-semibold text-fg-muted transition hover:bg-tint"
            >
              Clear
            </button>
          )}
        </div>
        {!task.due && (
          <div className="flex gap-2">
            {(
              [
                ['Today', today],
                ['Tomorrow', addDays(today, 1)],
              ] as const
            ).map(([label, day]) => (
              <button
                key={label}
                type="button"
                onClick={() => void updateTask(task.id, { due: day })}
                className="rounded-full bg-tint px-3 py-1.5 text-xs font-semibold text-fg-muted transition hover:text-fg"
              >
                {label}
              </button>
            ))}
          </div>
        )}
      </Field>

      <Field label="Repeat">
        <select
          value={choice}
          disabled={!task.due}
          onChange={(event) =>
            task.due &&
            void updateTask(task.id, {
              recurrence: ruleFor(event.target.value as RepeatChoice, task.due),
            })
          }
          aria-label="Repeat"
          className={`${fieldClass} w-full`}
        >
          {REPEAT_CHOICES.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
          {choice === 'custom' && task.recurrence && (
            <option value="custom">
              {describeRecurrence(task.recurrence)}
            </option>
          )}
        </select>
        {!task.due && (
          <p className="text-xs text-fg-subtle">
            Give it a date to make it repeat.
          </p>
        )}
      </Field>

      <Field label="Subject">
        <SubjectPicker
          value={task.subjectId}
          onChange={(subjectId) => void updateTask(task.id, { subjectId })}
        />
        {task.subjectId && (
          <button
            type="button"
            onClick={() => void updateTask(task.id, { subjectId: null })}
            className="rounded-full px-3 py-1.5 text-xs font-semibold text-fg-muted transition hover:bg-tint"
          >
            No subject
          </button>
        )}
      </Field>

      <Field label="Priority">
        <SegmentedControl<`${Priority}`>
          label="Priority"
          value={`${task.priority}`}
          options={([0, 1, 2, 3] as const).map((level) => ({
            value: `${level}`,
            label: level === 0 ? 'None' : PRIORITY_NAMES[level],
          }))}
          onChange={(value) =>
            void updateTask(task.id, { priority: Number(value) as Priority })
          }
        />
      </Field>

      <div className="space-y-2">
        <ActionRow
          icon={<TrashIcon />}
          label={
            confirmDelete ? 'Tap again to delete this task' : 'Delete task'
          }
          onClick={() => {
            if (!confirmDelete) return setConfirmDelete(true)
            void deleteTask(task.id)
            closeTaskEditor()
          }}
          danger
        />
        <p className="px-1 text-xs text-fg-subtle">
          Added{' '}
          {formatDateKey(task.createdAt.slice(0, 10), {
            day: 'numeric',
            month: 'short',
          })}
          {task.completedAt &&
            ` · done ${formatDateKey(task.completedAt.slice(0, 10), { day: 'numeric', month: 'short' })}`}
        </p>
      </div>
    </div>
  )
}
