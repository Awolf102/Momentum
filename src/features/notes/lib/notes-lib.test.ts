import { describe, expect, it } from 'vitest'
import { checkboxPositions, toggleCheckbox } from './checkboxes'
import { formatEdited, noteFromText } from './format'
import { linkQueryAt, suggestLinks } from './suggest'

describe('checkboxes', () => {
  const note = [
    '- [ ] read chapter 3',
    '- [x] problem set',
    '  1. [ ] nested',
    '> - [ ] quoted',
    '- [ ]',
    '```',
    '- [ ] in code',
    '```',
    'not a box: `- [ ] code`',
  ].join('\n')

  it('finds the boxes markdown shows, not ones in code', () => {
    expect(checkboxPositions(note)).toHaveLength(4)
  })

  it('ticks and unticks by position', () => {
    const ticked = toggleCheckbox(note, 0)
    expect(ticked.startsWith('- [x] read chapter 3')).toBe(true)
    expect(toggleCheckbox(ticked, 0)).toBe(note)
    expect(toggleCheckbox(note, 1)).toContain('- [ ] problem set')
    expect(toggleCheckbox(note, 3)).toContain('> - [x] quoted')
    expect(toggleCheckbox(note, 9)).toBe(note)
  })
})

describe('link suggestions', () => {
  it('knows when a link is being typed', () => {
    const text = 'See [[Karn'
    expect(linkQueryAt(text, text.length)).toEqual({ start: 6, text: 'Karn' })
    expect(linkQueryAt('See [[Done]] then', 17)).toBeNull()
    expect(linkQueryAt('[[a\nb', 5)).toBeNull()
    expect(linkQueryAt('`[[code', 7)).toBeNull()
  })

  const notes = [
    { title: 'Karnaugh maps', updatedAt: '2026-10-01' },
    { title: 'Boolean algebra', updatedAt: '2026-10-05' },
    { title: 'Maps of Europe', updatedAt: '2026-10-03' },
    { title: '', updatedAt: '2026-10-09' },
  ]
  const tasks = [{ title: 'Lab report', updatedAt: '2026-10-02' }]

  it('suggests matching titles, best match first', () => {
    expect(suggestLinks('maps', { notes, tasks }).map((s) => s.label)).toEqual([
      'Maps of Europe',
      'Karnaugh maps',
    ])
    expect(suggestLinks('', { notes, tasks })[0].label).toBe('Boolean algebra')
    expect(suggestLinks('task:lab', { notes, tasks })).toEqual([
      { insert: 'task:Lab report', label: 'Lab report', kind: 'task' },
    ])
  })
})

describe('formatting', () => {
  const now = new Date(2026, 9, 10, 15, 0)

  it('says when a note was edited, briefly', () => {
    expect(
      formatEdited(new Date(2026, 9, 10, 9, 5).toISOString(), now),
    ).toMatch(/9:05/)
    expect(formatEdited(new Date(2026, 9, 7).toISOString(), now)).toMatch(/Wed/)
    expect(formatEdited(new Date(2026, 8, 1).toISOString(), now)).toMatch(/Sep/)
    expect(formatEdited(new Date(2025, 8, 1).toISOString(), now)).toMatch(
      /2025/,
    )
  })

  it('turns a captured thought into a note', () => {
    expect(noteFromText('Idea for the lab', 'https://example.com')).toEqual({
      title: 'Idea for the lab',
      body: 'https://example.com',
    })
    // A link in the text moves to the body.
    const url = 'https://www.example.com/gray-code/'
    expect(noteFromText(`Great article: ${url}`, url)).toEqual({
      title: 'Great article',
      body: url,
    })
    expect(noteFromText(url, url)).toEqual({
      title: 'example.com/gray-code',
      body: url,
    })
    expect(noteFromText('Title line\nmore detail')).toEqual({
      title: 'Title line',
      body: 'more detail',
    })
    const long = 'word '.repeat(30).trim()
    const note = noteFromText(long)
    expect(note.title.length).toBeLessThanOrEqual(60)
    expect(note.body).toBe(long)
  })
})
