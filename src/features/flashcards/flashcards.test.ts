import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'
import { addHabit, habitCheckIns, habitsStore, isDone } from '@/features/habits'
import { closeDb } from '@/lib/db/db'
import { COLLECTION_STORES, DB_NAME } from '@/lib/db/schema'
import { indexedDbCollectionBackend } from '@/lib/storage'
import {
  addCards,
  cards,
  editCard,
  findSimilar,
  parseCard,
  resetCard,
} from './cards'
import { buildQueue } from './lib/queue'
import { markHabit, recordRating, undoRating } from './review'
import { reviewsBetween } from './reviews'
import { createScheduler } from './scheduler'
import { cardSettingsStore, updateCardSettings } from './settings'

const NOW = new Date('2026-10-10T09:00:00+11:00')
const minutes = (date: Date, count: number) =>
  new Date(date.getTime() + count * 60_000)

afterEach(async () => {
  await Promise.all([cards.clear(), habitCheckIns.clear()])
  habitsStore.set({ habits: [] })
  cardSettingsStore.set({ newPerDay: 20, retention: 0.9, habitId: null })
  await closeDb()
  indexedDB.deleteDatabase(DB_NAME)
})

describe('cards', () => {
  it('are saved new, in the order they were written', async () => {
    const made = await addCards(
      [
        { front: ' What is a minterm? ', back: 'A product of every variable' },
        { front: 'Empty', back: '  ' },
        { front: 'Gray code?', back: 'Neighbours differ in one bit' },
      ],
      { subjectId: 'logic', source: { kind: 'note', id: 'n1', page: null } },
      NOW,
    )
    expect(made.map((card) => card.front)).toEqual([
      'What is a minterm?',
      'Gray code?',
    ])
    expect(made[0]).toMatchObject({
      subjectId: 'logic',
      source: { kind: 'note', id: 'n1' },
      schedule: { state: 'new', due: NOW.toISOString(), reps: 0 },
      introducedOn: null,
    })
    expect(
      buildQueue(cards.get(), { now: NOW, newPerDay: 20 }).map(
        (card) => card.front,
      ),
    ).toEqual(['What is a minterm?', 'Gray code?'])
    expect(
      findSimilar('what is a  MINTERM?', { kind: 'note', id: 'n1', page: null })
        ?.id,
    ).toBe(made[0].id)
    expect(findSimilar('what is a minterm?', null)).toBeUndefined()
  })

  it('keep their schedule when edited, and lose it when reset', async () => {
    const [card] = await addCards(
      [{ front: 'Q', back: 'A' }],
      { subjectId: null },
      NOW,
    )
    await cards.put({
      ...card,
      schedule: { ...card.schedule, state: 'review', reps: 4 },
    })
    await editCard(card.id, { back: 'A better answer', subjectId: 'logic' })
    expect(cards.find(card.id)).toMatchObject({
      back: 'A better answer',
      subjectId: 'logic',
      schedule: { state: 'review', reps: 4 },
    })
    await resetCard(card.id, NOW)
    expect(cards.find(card.id)?.schedule).toMatchObject({
      state: 'new',
      reps: 0,
    })
  })

  it('survive damaged records', () => {
    expect(parseCard({ id: 'x', front: 'Q', updatedAt: 'now' })).toBeNull()
    expect(
      parseCard({
        id: 'x',
        front: 'Q',
        back: 'A',
        updatedAt: '2026-10-10T00:00:00.000Z',
        schedule: 'broken',
        source: { kind: 'photo', id: 'p' },
        introducedOn: 'yesterday',
      }),
    ).toMatchObject({
      schedule: { state: 'new' },
      source: null,
      introducedOn: null,
    })
  })
})

describe('reviewing', () => {
  it('follows FSRS: short steps while learning, then days', async () => {
    const scheduler = createScheduler({ retention: 0.9, fuzz: false })
    const [card] = await addCards(
      [{ front: 'Q', back: 'A' }],
      { subjectId: null },
      NOW,
    )
    const first = scheduler.outcomes(card.schedule, NOW)
    expect(first[1]).toMatchObject({
      state: 'learning',
      due: minutes(NOW, 1).toISOString(),
    })
    expect(first[3]).toMatchObject({
      state: 'learning',
      due: minutes(NOW, 10).toISOString(),
    })
    expect(first[4].state).toBe('review')
    expect(Date.parse(first[4].due)).toBeGreaterThan(
      minutes(NOW, 24 * 60).getTime(),
    )

    const learnt = scheduler.outcomes(first[3], minutes(NOW, 10))
    expect(learnt[3].state).toBe('review')
    // Remembering it easily puts it further off than with effort.
    expect(Date.parse(learnt[4].due)).toBeGreaterThan(Date.parse(learnt[3].due))
    expect(Date.parse(learnt[3].due)).toBeGreaterThan(Date.parse(learnt[2].due))
    // Asking for better recall brings reviews sooner.
    const keen = createScheduler({ retention: 0.95, fuzz: false })
    expect(
      Date.parse(keen.outcomes(first[3], minutes(NOW, 10))[3].due),
    ).toBeLessThan(Date.parse(learnt[3].due))
  })

  it('saves the rating, logs it, and can take it back', async () => {
    const scheduler = createScheduler({ retention: 0.9, fuzz: false })
    const [card] = await addCards(
      [{ front: 'Q', back: 'A' }],
      { subjectId: null },
      NOW,
    )
    const next = scheduler.outcomes(card.schedule, NOW)[3]
    const rated = await recordRating(card, 3, next, {
      now: NOW,
      durationMs: 4200,
    })
    expect(cards.find(card.id)).toMatchObject({
      schedule: next,
      introducedOn: '2026-10-10',
    })
    const [review] = await reviewsBetween('2026-10-10', '2026-10-10')
    expect(review).toMatchObject({
      cardId: card.id,
      rating: 3,
      day: '2026-10-10',
      state: 'new',
      elapsedDays: 0,
      durationMs: 4200,
      due: next.due,
    })
    // New cards started today count towards the day's limit: with one a
    // day, only the step of the card being learnt is left.
    await addCards([{ front: 'Q2', back: 'A2' }], { subjectId: null }, NOW)
    expect(
      buildQueue(cards.get(), { now: minutes(NOW, 1), newPerDay: 1 }).map(
        (each) => each.id,
      ),
    ).toEqual([card.id])

    await undoRating(rated, minutes(NOW, 1))
    expect(cards.find(card.id)).toMatchObject({
      schedule: card.schedule,
      introducedOn: null,
    })
    expect(await reviewsBetween('2026-10-10', '2026-10-10')).toEqual([])
  })

  it('keeps the review log where backups read it', async () => {
    const [card] = await addCards(
      [{ front: 'Q', back: 'A' }],
      { subjectId: null },
      NOW,
    )
    const scheduler = createScheduler({ retention: 0.9, fuzz: false })
    await recordRating(card, 4, scheduler.outcomes(card.schedule, NOW)[4], {
      now: NOW,
    })
    // Backups export every collection store through this backend.
    expect(COLLECTION_STORES).toContain('cardReviews')
    const rows = await indexedDbCollectionBackend().getAll('cardReviews')
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ cardId: card.id, rating: 4 })
  })
})

describe('the habit', () => {
  it('is done once nothing is left to study today', async () => {
    const habit = addHabit('Review cards', [], NOW)!
    updateCardSettings({ habitId: habit.id })
    const scheduler = createScheduler({ retention: 0.9, fuzz: false })
    const [card] = await addCards(
      [{ front: 'Q', back: 'A' }],
      { subjectId: null },
      NOW,
    )

    // Learning: it's back in ten minutes, so the day isn't done.
    const step = await recordRating(
      card,
      3,
      scheduler.outcomes(card.schedule, NOW)[3],
      { now: NOW },
    )
    expect(isDone(habit.id, '2026-10-10')).toBe(false)

    const later = minutes(NOW, 11)
    await recordRating(
      step.card,
      3,
      scheduler.outcomes(step.card.schedule, later)[3],
      { now: later },
    )
    expect(isDone(habit.id, '2026-10-10')).toBe(true)
    // Done is done: it isn't ticked off again.
    expect(await markHabit(later)).toBe(false)
    expect(isDone(habit.id, '2026-10-10')).toBe(true)
  })

  it('is left alone without a linked habit', async () => {
    const [card] = await addCards(
      [{ front: 'Q', back: 'A' }],
      { subjectId: null },
      NOW,
    )
    const scheduler = createScheduler({ retention: 0.9, fuzz: false })
    await recordRating(card, 4, scheduler.outcomes(card.schedule, NOW)[4], {
      now: NOW,
    })
    expect(await markHabit(NOW)).toBe(false)
  })
})
