import type { ReactNode } from 'react'
import {
  BookIcon,
  CheckIcon,
  ChecklistIcon,
  InboxIcon,
  LibraryIcon,
  NoteIcon,
  RepeatIcon,
} from '@/components/icons'
import {
  describeSchedule,
  editHabit,
  habitsStore,
  liveHabits,
} from '@/features/habits'
import { inboxItems } from '@/features/inbox'
import { documents, documentTexts, loadDocumentTexts } from '@/features/library'
import { logEntries } from '@/features/log'
import { formatEdited, isEmptyNote, notes, plainLines } from '@/features/notes'
import {
  editRoutine,
  liveRoutines,
  PART_NAMES,
  routinesStore,
} from '@/features/routines'
import { subjectsStore } from '@/features/subjects'
import { editTask, tasks } from '@/features/tasks'
import type { PaletteResult } from '@/lib/commands'
import { formatDateKey, toDateKey } from '@/lib/date'
import { navigate, paths } from '@/lib/routes'
import {
  highlight,
  indexDoc,
  matchingLine,
  search,
  snippet,
  type IndexedDoc,
  type SearchDoc,
} from './lib/engine'

/** Results shown per kind, and in all. */
const PER_SECTION = 5
const LIMIT = 30
/** Between equally good matches, which kind comes first. */
const ORDER = {
  note: 0,
  document: 1,
  task: 2,
  habit: 3,
  routine: 4,
  log: 5,
  inbox: 6,
}

/** Something searchable, with what to show and do when it's found. */
interface Candidate {
  entry: IndexedDoc
  section: string
  icon: ReactNode
  detail?: string
  run: () => void
  /** For documents: the page the match is on (the line of its text). */
  atLine?: (line: number) => { detail: string; opens: string; run: () => void }
}

/** Gets search ready: loads the text of library documents. */
export async function prepareSearch(): Promise<void> {
  await loadDocumentTexts().catch(() => {})
}

// A record's words, worked out once per version of it (records are
// replaced, never changed, when edited). `version` covers what else the
// document shows, like a subject's name.
const indexed = new WeakMap<object, { version: string; entry: IndexedDoc }>()
function entryFor(
  record: object,
  version: string,
  make: () => SearchDoc,
): IndexedDoc {
  const cached = indexed.get(record)
  if (cached?.version === version) return cached.entry
  const entry = indexDoc(make())
  indexed.set(record, { version, entry })
  return entry
}

const day = (key: string, today: string) =>
  formatDateKey(key, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    ...(key.slice(0, 4) === today.slice(0, 4) ? {} : { year: 'numeric' }),
  })

function candidates(today: string): Candidate[] {
  const subjects = new Map(
    subjectsStore.get().subjects.map((subject) => [subject.id, subject.name]),
  )
  const subjectOf = (id: string | null) => (id && subjects.get(id)) || ''
  const found: Candidate[] = []

  for (const note of notes.get()) {
    if (isEmptyNote(note)) continue
    const subject = subjectOf(note.subjectId)
    found.push({
      entry: entryFor(note, subject, () => ({
        order: ORDER.note,
        key: `note:${note.id}`,
        title: note.title || 'Untitled',
        text: [...plainLines(note.body, { code: 'keep' }), subject].join('\n'),
        updatedAt: note.updatedAt,
        boost: note.pinned ? 0.5 : 0,
      })),
      section: 'Notes',
      icon: <NoteIcon />,
      detail: formatEdited(note.updatedAt),
      run: () => navigate(paths.note(note.id)),
    })
  }

  const texts = documentTexts()
  for (const document of documents.get()) {
    const pages = texts.get(document.id) ?? []
    const subject = subjectOf(document.subjectId)
    found.push({
      entry: entryFor(document, `${subject}|${pages.length}`, () => ({
        order: ORDER.document,
        key: `document:${document.id}`,
        title: document.title,
        // One line per page, so the line that matches is the page.
        text: [...pages.map((page) => page.replace(/\n/g, ' ')), subject].join(
          '\n',
        ),
        updatedAt: document.updatedAt,
      })),
      section: 'Documents',
      icon: <LibraryIcon />,
      detail: document.pages
        ? `${document.pages} ${document.pages === 1 ? 'page' : 'pages'}`
        : undefined,
      run: () => navigate(paths.document(document.id)),
      atLine: (line) =>
        line < pages.length
          ? {
              detail: `p. ${line + 1}`,
              opens: `document:${document.id}#${line + 1}`,
              run: () => navigate(paths.document(document.id, line + 1)),
            }
          : {
              detail: '',
              opens: `document:${document.id}`,
              run: () => navigate(paths.document(document.id)),
            },
    })
  }

  for (const task of tasks.get()) {
    const subject = subjectOf(task.subjectId)
    const done = task.status === 'done'
    found.push({
      entry: entryFor(task, subject, () => ({
        order: ORDER.task,
        key: `task:${task.id}`,
        title: task.title,
        text: subject,
        updatedAt: task.updatedAt,
        // Finished tasks are history: below the ones still to do, unless
        // one is a far better match (its exact title).
        boost: done ? -4 : 0,
      })),
      section: 'Tasks',
      icon: <ChecklistIcon />,
      detail: done ? 'Done' : task.due ? day(task.due, today) : undefined,
      run: () => editTask(task.id),
    })
  }

  for (const habit of liveHabits(habitsStore.get())) {
    found.push({
      entry: entryFor(habit, '', () => ({
        order: ORDER.habit,
        key: `habit:${habit.id}`,
        title: habit.name,
        text: '',
        updatedAt: habit.updatedAt,
      })),
      section: 'Habits',
      icon: <RepeatIcon />,
      detail: describeSchedule(habit.weekdays),
      run: () => editHabit(habit.id),
    })
  }

  for (const routine of liveRoutines(routinesStore.get())) {
    found.push({
      entry: entryFor(routine, '', () => ({
        order: ORDER.routine,
        key: `routine:${routine.id}`,
        title: routine.name,
        text: routine.steps.map((step) => step.text).join('\n'),
        updatedAt: routine.updatedAt,
      })),
      section: 'Routines',
      icon: <CheckIcon />,
      detail: PART_NAMES[routine.part],
      run: () => editRoutine(routine.id),
    })
  }

  for (const entry of logEntries.get()) {
    const title = day(entry.day, today)
    found.push({
      entry: entryFor(entry, title, () => ({
        order: ORDER.log,
        key: `log:${entry.id}`,
        title,
        text: entry.text,
        updatedAt: entry.updatedAt,
      })),
      section: 'Log',
      icon: <BookIcon />,
      run: () => navigate(paths.logDay(entry.day)),
    })
  }

  for (const item of inboxItems.get()) {
    const [first = '', ...rest] = item.text.split('\n')
    found.push({
      entry: entryFor(item, '', () => ({
        order: ORDER.inbox,
        key: `inbox:${item.id}`,
        title: first,
        text: [...rest, item.url ?? ''].join('\n'),
        updatedAt: item.updatedAt,
      })),
      section: 'Inbox',
      icon: <InboxIcon />,
      detail: day(toDateKey(new Date(item.createdAt)), today),
      run: () => navigate(paths.inbox),
    })
  }
  return found
}

/**
 * Everything matching the query — notes, tasks, habits, routines, the log
 * and the inbox — grouped by kind, the kind with the best match first.
 */
export function searchEverything(query: string): PaletteResult[] {
  const all = candidates(toDateKey(new Date()))
  const byEntry = new Map(all.map((candidate) => [candidate.entry, candidate]))
  const shown = new Map<string, Candidate[]>()
  let count = 0
  for (const { entry } of search(
    all.map((candidate) => candidate.entry),
    query,
    Infinity,
  )) {
    const candidate = byEntry.get(entry)!
    const group = shown.get(candidate.section) ?? []
    if (group.length >= PER_SECTION) continue
    group.push(candidate)
    shown.set(candidate.section, group)
    if (++count >= LIMIT) break
  }
  return [...shown.values()].flat().map((candidate) => {
    const { doc } = candidate.entry
    const line = candidate.atLine ? matchingLine(doc.text, query) : null
    const at = line !== null ? candidate.atLine?.(line) : undefined
    return {
      id: doc.key,
      section: candidate.section,
      icon: candidate.icon,
      title: highlight(doc.title, query),
      snippet: snippet(doc.text, query) ?? undefined,
      detail: at?.detail || candidate.detail,
      opens: at?.opens ?? doc.key,
      run: at?.run ?? candidate.run,
    }
  })
}
