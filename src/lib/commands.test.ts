import { describe, expect, it } from 'vitest'
import { filterCommands, type Command } from './commands'
import { matchesHotkey } from './hotkeys'

const command = (
  title: string,
  section: string,
  keywords?: string[],
): Command => ({
  id: title,
  title,
  section,
  keywords,
  run: () => {},
})

const commands = [
  command('Check in for today', 'Streak', ['done']),
  command('Open settings', 'General', ['preferences']),
  command('Background: Moonrise', 'Backgrounds'),
  command('Share streak card', 'Streak'),
]

describe('filterCommands', () => {
  it('returns everything for an empty query', () => {
    expect(filterCommands(commands, '  ')).toHaveLength(4)
  })

  it('requires every word and matches keywords', () => {
    expect(filterCommands(commands, 'prefer').map((c) => c.title)).toEqual([
      'Open settings',
    ])
    expect(filterCommands(commands, 'streak card').map((c) => c.title)).toEqual(
      ['Share streak card'],
    )
  })

  it('ranks titles that start with the query first', () => {
    expect(filterCommands(commands, 'sh')[0].title).toBe('Share streak card')
  })
})

describe('matchesHotkey', () => {
  const key = (init: Partial<KeyboardEvent>) => ({
    key: '',
    metaKey: false,
    ctrlKey: false,
    altKey: false,
    ...init,
  })

  it('matches plain keys only without modifiers', () => {
    expect(matchesHotkey(key({ key: 'c' }), { key: 'c' })).toBe(true)
    expect(matchesHotkey(key({ key: 'C', shiftKey: true }), { key: 'c' })).toBe(
      true,
    )
    expect(matchesHotkey(key({ key: 'c', metaKey: true }), { key: 'c' })).toBe(
      false,
    )
  })

  it('accepts ⌘ or Ctrl for mod shortcuts', () => {
    expect(
      matchesHotkey(key({ key: 'k', metaKey: true }), { key: 'k', mod: true }),
    ).toBe(true)
    expect(
      matchesHotkey(key({ key: 'k', ctrlKey: true }), { key: 'k', mod: true }),
    ).toBe(true)
    expect(matchesHotkey(key({ key: 'k' }), { key: 'k', mod: true })).toBe(
      false,
    )
  })
})
