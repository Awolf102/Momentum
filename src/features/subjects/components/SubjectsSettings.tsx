import { useEffect, useState, type FormEvent } from 'react'
import { PencilIcon, PlusIcon, TrashIcon } from '@/components/icons'
import { useStore } from '@/lib/store'
import {
  addSubject,
  liveSubjects,
  MAX_NAME_LENGTH,
  removeSubject,
  renameSubject,
  setSubjectColor,
  subjectsStore,
} from '../store'
import { SUBJECT_COLORS, type Subject, type SubjectColor } from '../types'
import { SubjectDot } from './SubjectDot'

const COLORS = Object.keys(SUBJECT_COLORS) as SubjectColor[]

/** Add, rename, recolour and delete subjects. */
export function SubjectsSettings() {
  const subjects = liveSubjects(useStore(subjectsStore))
  const [name, setName] = useState('')

  function add(event: FormEvent) {
    event.preventDefault()
    if (addSubject(name)) setName('')
  }

  return (
    <div className="space-y-2">
      {subjects.length === 0 && (
        <p className="rounded-2xl bg-tint px-4 py-3 text-sm text-fg-muted">
          No subjects yet.
        </p>
      )}
      <ul className="space-y-2">
        {subjects.map((subject) => (
          <SubjectRow key={subject.id} subject={subject} />
        ))}
      </ul>
      <form
        onSubmit={add}
        className="flex items-center gap-2 rounded-2xl bg-tint py-1.5 pr-1.5 pl-4 ring-orange-300/60 focus-within:ring-2"
      >
        <PlusIcon className="shrink-0 text-fg-subtle" />
        <input
          value={name}
          maxLength={MAX_NAME_LENGTH}
          onChange={(event) => setName(event.target.value)}
          placeholder="Add a subject"
          aria-label="New subject name"
          className="min-w-0 flex-1 bg-transparent py-1.5 text-sm outline-none placeholder:text-fg-subtle focus-visible:outline-none"
        />
        <button
          type="submit"
          disabled={!name.trim()}
          className="rounded-full bg-linear-to-br from-amber-300 to-orange-500 px-3.5 py-1.5 text-xs font-semibold text-orange-950 transition disabled:opacity-40"
        >
          Add
        </button>
      </form>
      <p className="px-1 pt-1 text-xs text-fg-subtle">
        Deleting a subject hides it. Sessions you already finished keep it.
      </p>
    </div>
  )
}

function SubjectRow({ subject }: { subject: Subject }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(subject.name)
  const [confirming, setConfirming] = useState(false)

  useEffect(() => {
    if (!confirming) return
    const timer = setTimeout(() => setConfirming(false), 4000)
    return () => clearTimeout(timer)
  }, [confirming])

  function save(event: FormEvent) {
    event.preventDefault()
    renameSubject(subject.id, draft)
    setEditing(false)
  }

  const nextColor = COLORS[(COLORS.indexOf(subject.color) + 1) % COLORS.length]

  return (
    <li className="flex items-center gap-2 rounded-2xl bg-tint py-1.5 pr-1.5 pl-3">
      <button
        type="button"
        onClick={() => setSubjectColor(subject.id, nextColor)}
        aria-label={`Change ${subject.name}'s colour`}
        title="Change colour"
        className="grid size-7 shrink-0 place-items-center rounded-full transition hover:bg-line"
      >
        <SubjectDot color={subject.color} className="size-3" />
      </button>
      {editing ? (
        <form
          onSubmit={save}
          className="flex min-w-0 flex-1 items-center gap-1"
        >
          <input
            autoFocus
            value={draft}
            maxLength={MAX_NAME_LENGTH}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                setDraft(subject.name)
                setEditing(false)
              }
            }}
            aria-label={`Rename ${subject.name}`}
            className="min-w-0 flex-1 rounded-lg bg-transparent py-1 text-sm outline-none focus-visible:outline-none"
          />
          <button
            type="submit"
            className="rounded-full px-3 py-1.5 text-xs font-semibold transition hover:bg-line"
          >
            Save
          </button>
        </form>
      ) : (
        <>
          <span className="min-w-0 flex-1 truncate text-sm">
            {subject.name}
          </span>
          <button
            type="button"
            onClick={() => {
              setDraft(subject.name)
              setEditing(true)
            }}
            aria-label={`Rename ${subject.name}`}
            title="Rename"
            className="grid size-8 place-items-center rounded-full text-fg-muted transition hover:bg-line hover:text-fg"
          >
            <PencilIcon />
          </button>
          <button
            type="button"
            onClick={() =>
              confirming ? removeSubject(subject.id) : setConfirming(true)
            }
            aria-label={
              confirming
                ? `Tap again to delete ${subject.name}`
                : `Delete ${subject.name}`
            }
            title="Delete"
            className="flex h-8 items-center justify-center gap-1.5 rounded-full px-2 text-rose-300 transition hover:bg-line light:text-rose-600"
          >
            <TrashIcon />
            {confirming && (
              <span className="text-xs font-semibold">Delete?</span>
            )}
          </button>
        </>
      )}
    </li>
  )
}
