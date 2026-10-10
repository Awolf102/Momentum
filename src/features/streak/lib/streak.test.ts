import { describe, expect, it } from 'vitest'
import { describeStreak } from './copy'
import { depthToLevel, streakDepths, summarizeStreak } from './streak'

const TODAY = '2026-10-10'

describe('summarizeStreak', () => {
  it('starts empty', () => {
    expect(summarizeStreak([], TODAY)).toMatchObject({
      status: 'new',
      current: 0,
      longest: 0,
      total: 0,
      checkedInToday: false,
    })
  })

  it('counts a run that ends today', () => {
    const summary = summarizeStreak(
      ['2026-10-08', '2026-10-09', '2026-10-10'],
      TODAY,
    )
    expect(summary).toMatchObject({
      status: 'done',
      current: 3,
      longest: 3,
      checkedInToday: true,
    })
  })

  it('keeps the streak alive while today is still open', () => {
    const summary = summarizeStreak(['2026-10-08', '2026-10-09'], TODAY)
    expect(summary).toMatchObject({
      status: 'pending',
      current: 2,
      checkedInToday: false,
    })
  })

  it('resets after a full missed day', () => {
    const summary = summarizeStreak(
      ['2026-10-06', '2026-10-07', '2026-10-08'],
      TODAY,
    )
    expect(summary).toMatchObject({
      status: 'broken',
      current: 0,
      longest: 3,
      previous: 3,
    })
  })

  it('tracks the longest streak separately from the current one', () => {
    const dates = [
      '2026-09-01',
      '2026-09-02',
      '2026-09-03',
      '2026-09-04',
      '2026-09-05',
      '2026-10-09',
      '2026-10-10',
    ]
    expect(summarizeStreak(dates, TODAY)).toMatchObject({
      current: 2,
      longest: 5,
      total: 7,
      firstCheckIn: '2026-09-01',
    })
  })

  it('counts streaks across month and year boundaries', () => {
    const dates = ['2025-12-30', '2025-12-31', '2026-01-01', '2026-01-02']
    expect(summarizeStreak(dates, '2026-01-02').current).toBe(4)
  })

  it('ignores check-ins dated in the future', () => {
    const summary = summarizeStreak(['2026-10-09', '2026-10-12'], TODAY)
    expect(summary).toMatchObject({ status: 'pending', current: 1, total: 1 })
  })
})

describe('streakDepths', () => {
  it('numbers each day within its run', () => {
    const depths = streakDepths([
      '2026-10-01',
      '2026-10-02',
      '2026-10-03',
      '2026-10-05',
    ])
    expect([...depths.values()]).toEqual([1, 2, 3, 1])
  })

  it('maps depth onto four calendar levels', () => {
    expect([0, 1, 2, 3, 4, 6, 7, 30].map(depthToLevel)).toEqual([
      0, 1, 2, 2, 3, 3, 4, 4,
    ])
  })
})

describe('describeStreak', () => {
  it('speaks to where the user is', () => {
    expect(describeStreak(summarizeStreak([], TODAY))).toMatch(/day one/)
    expect(
      describeStreak(
        summarizeStreak(['2026-10-08', '2026-10-09', '2026-10-10'], TODAY),
      ),
    ).toBe("You've shown up for yourself 3 days in a row.")
    expect(describeStreak(summarizeStreak(['2026-10-09'], TODAY))).toBe(
      'Check in today to keep your 1-day streak alive.',
    )
    expect(
      describeStreak(summarizeStreak(['2026-10-01', '2026-10-02'], TODAY)),
    ).toMatch(/2-day streak before/)
  })
})
