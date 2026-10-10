import { useState, type FormEvent, type ReactNode } from 'react'
import { ActionRow } from '@/components/ActionRow'
import { DayPicker } from '@/components/DayPicker'
import { CloseIcon, PlusIcon, TrashIcon } from '@/components/icons'
import { SegmentedControl } from '@/components/SegmentedControl'
import { Sheet } from '@/components/Sheet'
import { summarizeHabit } from '@/features/habits'
import { useStore } from '@/lib/store'
import { useToday } from '@/lib/useToday'
import { useCompletedDays, useRoutines } from '../hooks/useRoutines'
import { PART_NAMES, TEMPLATES } from '../lib/day'
import {
  addRoutine,
  addStep,
  closeRoutineEditor,
  editingRoutineStore,
  editRoutine,
  MAX_NAME_LENGTH,
  MAX_STEP_LENGTH,
  moveStep,
  removeRoutine,
  removeStep,
  updateRoutine,
  updateStep,
} from '../store'
import type { PartOfDay, Routine } from '../types'
import { PartIcon } from './PartIcon'

const EMPTY = new Set<string>()
const PARTS: PartOfDay[] = ['morning', 'afternoon', 'evening', 'anytime']

/** Starting a routine, or editing one: its steps, part of the day and days. */
export function RoutineSheet() {
  const editing = useStore(editingRoutineStore)
  const routine = useRoutines().find((item) => item.id === editing)
  return (
    <Sheet
      open={editing === 'new' || Boolean(routine)}
      onClose={closeRoutineEditor}
      title={editing === 'new' ? 'New routine' : 'Routine'}
    >
      {editing === 'new' ? (
        <NewRoutine />
      ) : (
        routine && <RoutineEditor key={routine.id} routine={routine} />
      )}
    </Sheet>
  )
}

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

function PartControl({
  value,
  onChange,
}: {
  value: PartOfDay
  onChange: (part: PartOfDay) => void
}) {
  return (
    <SegmentedControl<PartOfDay>
      compact
      label="Part of the day"
      value={value}
      options={PARTS.map((part) => ({
        value: part,
        label: part === 'anytime' ? 'Any' : PART_NAMES[part],
      }))}
      onChange={onChange}
    />
  )
}

function NewRoutine() {
  const [name, setName] = useState('')
  const [part, setPart] = useState<PartOfDay>('morning')
  const create = (input: Parameters<typeof addRoutine>[0]) => {
    const routine = addRoutine(input)
    if (routine) editRoutine(routine.id)
  }
  return (
    <div className="space-y-6 pt-1">
      <Field label="Start from">
        <div className="space-y-2">
          {TEMPLATES.map((template) => (
            <button
              key={template.name}
              type="button"
              onClick={() => create(template)}
              className="flex w-full items-start gap-3 rounded-2xl bg-tint px-4 py-3 text-left transition hover:bg-line"
            >
              <PartIcon
                part={template.part}
                className="mt-0.5 text-base text-fg-muted"
              />
              <span className="min-w-0">
                <span className="block text-sm font-medium">
                  {template.name}
                </span>
                <span className="block text-xs text-fg-subtle">
                  {template.steps.join(' · ')}
                </span>
              </span>
            </button>
          ))}
        </div>
      </Field>
      <form
        onSubmit={(event: FormEvent) => {
          event.preventDefault()
          create({ name, part })
        }}
        className="space-y-3"
      >
        <Field label="Or your own">
          <input
            value={name}
            maxLength={MAX_NAME_LENGTH}
            onChange={(event) => setName(event.target.value)}
            placeholder="Name, e.g. Before the gym"
            aria-label="Name"
            className="w-full rounded-xl bg-tint px-3.5 py-3 text-base font-medium outline-none placeholder:text-fg-subtle focus-visible:outline-2"
          />
        </Field>
        <PartControl value={part} onChange={setPart} />
        <button
          type="submit"
          disabled={!name.trim()}
          className="w-full rounded-full bg-linear-to-br from-amber-300 via-orange-400 to-orange-500 px-6 py-3 font-semibold text-orange-950 disabled:opacity-40"
        >
          Create routine
        </button>
      </form>
    </div>
  )
}

function RoutineEditor({ routine }: { routine: Routine }) {
  const today = useToday()
  const days = useCompletedDays().get(routine.id) ?? EMPTY
  const [name, setName] = useState(routine.name)
  const [newStep, setNewStep] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const summary = summarizeHabit(
    days,
    today,
    routine.weekdays,
    routine.createdAt.slice(0, 10),
  )

  return (
    <div className="space-y-6 pt-1">
      <input
        value={name}
        maxLength={MAX_NAME_LENGTH}
        onChange={(event) => setName(event.target.value)}
        onBlur={() =>
          name.trim()
            ? name !== routine.name && updateRoutine(routine.id, { name })
            : setName(routine.name)
        }
        onKeyDown={(event) =>
          event.key === 'Enter' && event.currentTarget.blur()
        }
        aria-label="Name"
        className="w-full rounded-xl bg-tint px-3.5 py-3 text-base font-medium outline-none focus-visible:outline-2"
      />

      <dl className="grid grid-cols-3 gap-2 text-center">
        {(
          [
            ['In a row', summary.current],
            ['Longest', summary.longest],
            ['Days done', summary.total],
          ] as const
        ).map(([label, value]) => (
          <div key={label} className="rounded-2xl bg-tint px-1 py-3">
            <dd className="font-serif text-2xl leading-none tabular-nums">
              {value}
            </dd>
            <dt className="mt-1.5 text-[11px] text-fg-subtle">{label}</dt>
          </div>
        ))}
      </dl>

      <Field label="Steps">
        <ol className="space-y-2">
          {routine.steps.map((step, index) => (
            <li key={step.id} className="flex items-center gap-1.5">
              <span className="w-5 shrink-0 text-center text-xs text-fg-subtle tabular-nums">
                {index + 1}
              </span>
              <input
                defaultValue={step.text}
                maxLength={MAX_STEP_LENGTH}
                onBlur={(event) => {
                  const text = event.target.value
                  if (!text.trim()) event.target.value = step.text
                  else if (text !== step.text)
                    updateStep(routine.id, step.id, text)
                }}
                onKeyDown={(event) =>
                  event.key === 'Enter' && event.currentTarget.blur()
                }
                aria-label={`Step ${index + 1}`}
                className="h-10 min-w-0 flex-1 rounded-xl bg-tint px-3 text-sm outline-none focus-visible:outline-2"
              />
              <button
                type="button"
                onClick={() => moveStep(routine.id, step.id, -1)}
                disabled={index === 0}
                aria-label={`Move step ${index + 1} up`}
                className="grid size-8 place-items-center rounded-full text-fg-muted transition hover:bg-tint disabled:opacity-30"
              >
                ↑
              </button>
              <button
                type="button"
                onClick={() => moveStep(routine.id, step.id, 1)}
                disabled={index === routine.steps.length - 1}
                aria-label={`Move step ${index + 1} down`}
                className="grid size-8 place-items-center rounded-full text-fg-muted transition hover:bg-tint disabled:opacity-30"
              >
                ↓
              </button>
              <button
                type="button"
                onClick={() => removeStep(routine.id, step.id)}
                aria-label={`Remove step ${index + 1}`}
                className="grid size-8 place-items-center rounded-full text-fg-muted transition hover:bg-tint"
              >
                <CloseIcon />
              </button>
            </li>
          ))}
        </ol>
        <form
          onSubmit={(event) => {
            event.preventDefault()
            addStep(routine.id, newStep)
            setNewStep('')
          }}
          className="flex items-center gap-2"
        >
          <input
            value={newStep}
            maxLength={MAX_STEP_LENGTH}
            onChange={(event) => setNewStep(event.target.value)}
            placeholder="Add a step"
            aria-label="New step"
            className="h-10 min-w-0 flex-1 rounded-xl bg-tint px-3 text-sm outline-none placeholder:text-fg-subtle focus-visible:outline-2"
          />
          <button
            type="submit"
            disabled={!newStep.trim()}
            aria-label="Add step"
            className="grid size-10 place-items-center rounded-xl bg-tint text-fg-muted transition hover:text-fg disabled:opacity-40"
          >
            <PlusIcon />
          </button>
        </form>
      </Field>

      <Field label="Part of the day">
        <PartControl
          value={routine.part}
          onChange={(part) => updateRoutine(routine.id, { part })}
        />
      </Field>

      <Field label="Days">
        <DayPicker
          value={routine.weekdays}
          onChange={(weekdays) => updateRoutine(routine.id, { weekdays })}
        />
      </Field>

      <ActionRow
        icon={<TrashIcon />}
        label={
          confirmDelete ? 'Tap again to delete this routine' : 'Delete routine'
        }
        onClick={() => {
          if (!confirmDelete) return setConfirmDelete(true)
          removeRoutine(routine.id)
          closeRoutineEditor()
        }}
        danger
      />
    </div>
  )
}
