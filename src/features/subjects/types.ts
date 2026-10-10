/** Colours a subject can have: a dot on chips, the ring while you focus. */
export const SUBJECT_COLORS = {
  amber: 'oklch(0.82 0.15 75)',
  sky: 'oklch(0.76 0.12 230)',
  violet: 'oklch(0.72 0.15 295)',
  teal: 'oklch(0.77 0.11 185)',
  rose: 'oklch(0.73 0.16 10)',
  lime: 'oklch(0.82 0.16 130)',
  orange: 'oklch(0.76 0.16 50)',
  slate: 'oklch(0.72 0.03 260)',
} as const

export type SubjectColor = keyof typeof SUBJECT_COLORS

/**
 * Something you work on: a course, a project, a habit. Focus sessions are
 * tagged with one; tasks and notes can be later. Deleting only hides it, so
 * history keeps its subject.
 */
export interface Subject {
  id: string
  name: string
  color: SubjectColor
  createdAt: string
  updatedAt: string
  deletedAt?: string | null
}
