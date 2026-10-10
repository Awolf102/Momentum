import { isRecord } from '@/lib/guards'
import { createId } from '@/lib/id'
import { createPersistentStore } from '@/lib/persistentStore'
import { SUBJECT_COLORS, type Subject, type SubjectColor } from './types'

export interface SubjectsData {
  subjects: Subject[]
}

const SEEDED = '2026-01-01T00:00:00.000Z'

/** A few to start with; rename or delete them freely. */
export const DEFAULT_SUBJECTS: Subject[] = [
  {
    id: 'calculus',
    name: 'Calculus',
    color: 'amber',
    createdAt: SEEDED,
    updatedAt: SEEDED,
  },
  {
    id: 'digital-logic',
    name: 'Digital Logic',
    color: 'sky',
    createdAt: SEEDED,
    updatedAt: SEEDED,
  },
  {
    id: 'programming',
    name: 'Programming',
    color: 'violet',
    createdAt: SEEDED,
    updatedAt: SEEDED,
  },
  {
    id: 'reading',
    name: 'Reading',
    color: 'teal',
    createdAt: SEEDED,
    updatedAt: SEEDED,
  },
]

const COLOR_NAMES = Object.keys(SUBJECT_COLORS) as SubjectColor[]
export const MAX_NAME_LENGTH = 40

function parseSubject(value: unknown): Subject | null {
  if (!isRecord(value)) return null
  const { id, name, color, createdAt, updatedAt, deletedAt } = value
  if (typeof id !== 'string' || typeof name !== 'string' || !name.trim())
    return null
  return {
    id,
    name: name.trim().slice(0, MAX_NAME_LENGTH),
    color: COLOR_NAMES.includes(color as SubjectColor)
      ? (color as SubjectColor)
      : 'slate',
    createdAt: typeof createdAt === 'string' ? createdAt : SEEDED,
    updatedAt: typeof updatedAt === 'string' ? updatedAt : SEEDED,
    deletedAt: typeof deletedAt === 'string' ? deletedAt : null,
  }
}

export function parseSubjects(data: unknown): SubjectsData | null {
  if (!isRecord(data) || !Array.isArray(data.subjects)) return null
  const seen = new Set<string>()
  const subjects: Subject[] = []
  for (const value of data.subjects) {
    const subject = parseSubject(value)
    if (!subject || seen.has(subject.id)) continue
    seen.add(subject.id)
    subjects.push(subject)
  }
  return { subjects }
}

/**
 * Restoring a backup keeps the subjects on both sides (sessions from either may
 * use them); where both have the same one, the later edit wins.
 */
export function mergeSubjects(
  current: SubjectsData,
  incoming: SubjectsData,
): SubjectsData {
  const byId = new Map(current.subjects.map((subject) => [subject.id, subject]))
  for (const subject of incoming.subjects) {
    const mine = byId.get(subject.id)
    if (!mine || subject.updatedAt > mine.updatedAt)
      byId.set(subject.id, subject)
  }
  return { subjects: [...byId.values()] }
}

export const subjectsStore = createPersistentStore<SubjectsData>({
  key: 'momentum.subjects',
  version: 1,
  defaultValue: { subjects: DEFAULT_SUBJECTS },
  parse: parseSubjects,
  merge: mergeSubjects,
})

export const liveSubjects = (data: SubjectsData): Subject[] =>
  data.subjects.filter((subject) => !subject.deletedAt)

/** The first colour not used by another subject, so new ones stand apart. */
export function nextColor(subjects: readonly Subject[]): SubjectColor {
  const used = new Set(
    liveSubjects({ subjects: [...subjects] }).map((subject) => subject.color),
  )
  return (
    COLOR_NAMES.find((color) => !used.has(color)) ??
    COLOR_NAMES[subjects.length % COLOR_NAMES.length]
  )
}

/** Adds a subject (or returns the existing one with that name). */
export function addSubject(name: string, now = new Date()): Subject | null {
  const clean = name.trim().slice(0, MAX_NAME_LENGTH)
  if (!clean) return null
  const existing = liveSubjects(subjectsStore.get()).find(
    (subject) => subject.name.toLowerCase() === clean.toLowerCase(),
  )
  if (existing) return existing
  const stamp = now.toISOString()
  const subject: Subject = {
    id: createId(),
    name: clean,
    color: nextColor(subjectsStore.get().subjects),
    createdAt: stamp,
    updatedAt: stamp,
  }
  subjectsStore.set((data) => ({ subjects: [...data.subjects, subject] }))
  return subject
}

function update(id: string, change: Partial<Subject>, now = new Date()) {
  subjectsStore.set((data) => ({
    subjects: data.subjects.map((subject) =>
      subject.id === id
        ? { ...subject, ...change, updatedAt: now.toISOString() }
        : subject,
    ),
  }))
}

export function renameSubject(id: string, name: string): void {
  const clean = name.trim().slice(0, MAX_NAME_LENGTH)
  if (clean) update(id, { name: clean })
}

export function setSubjectColor(id: string, color: SubjectColor): void {
  update(id, { color })
}

/** Hides a subject. Its history keeps it, so totals by subject still add up. */
export function removeSubject(id: string, now = new Date()): void {
  update(id, { deletedAt: now.toISOString() }, now)
}

/** A subject by id, deleted ones included (for history). */
export function findSubject(
  id: string | null | undefined,
): Subject | undefined {
  return id
    ? subjectsStore.get().subjects.find((subject) => subject.id === id)
    : undefined
}
