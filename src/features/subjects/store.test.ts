import { describe, expect, it } from 'vitest'
import { mergeSubjects, type SubjectsData } from './store'
import type { Subject } from './types'

const subject = (
  id: string,
  name: string,
  updatedAt = '2026-10-01T00:00:00.000Z',
  deletedAt: string | null = null,
): Subject => ({
  id,
  name,
  color: 'amber',
  createdAt: '2026-10-01T00:00:00.000Z',
  updatedAt,
  deletedAt,
})

describe('restoring subjects from a backup', () => {
  it('keeps both sides, and the later edit of the same subject', () => {
    const here: SubjectsData = {
      subjects: [
        subject('calculus', 'Calculus'),
        subject('physics', 'Physics'),
        subject('reading', 'Reading', '2026-10-09T00:00:00.000Z'),
      ],
    }
    const backup: SubjectsData = {
      subjects: [
        subject('calculus', 'Calculus II', '2026-10-05T00:00:00.000Z'),
        subject('reading', 'Books', '2026-10-02T00:00:00.000Z'),
        subject('chemistry', 'Chemistry'),
      ],
    }
    expect(
      mergeSubjects(here, backup).subjects.map((item) => item.name),
    ).toEqual(['Calculus II', 'Physics', 'Reading', 'Chemistry'])
  })

  it('keeps a deletion that happened after the backup', () => {
    const here: SubjectsData = {
      subjects: [
        subject(
          'physics',
          'Physics',
          '2026-10-09T00:00:00.000Z',
          '2026-10-09T00:00:00.000Z',
        ),
      ],
    }
    const backup: SubjectsData = { subjects: [subject('physics', 'Physics')] }
    expect(mergeSubjects(here, backup).subjects[0].deletedAt).toBe(
      '2026-10-09T00:00:00.000Z',
    )
  })
})
