import { fsrs } from 'ts-fsrs'
import { fromFsrs, toFsrs } from './lib/fsrs'
import type { Rating, Schedule } from './types'

// FSRS comes with the Cards page (it's small), so studying never waits for
// it; nothing else imports this file.

/** What each rating would do to a card, at one moment. */
export type Outcomes = Record<Rating, Schedule>

export interface Scheduler {
  /**
   * The schedule each rating would give. Rating a card uses the outcome
   * that was shown, so a button's interval is what you get (FSRS adds a
   * little randomness to long intervals, seeded by the moment).
   */
  outcomes(schedule: Schedule, now: Date): Outcomes
}

export interface SchedulerOptions {
  /** The chance of remembering that reviews aim for. */
  retention: number
  /** Spread long intervals a little, so cards made together drift apart. */
  fuzz?: boolean
}

export function createScheduler({
  retention,
  fuzz = true,
}: SchedulerOptions): Scheduler {
  const scheduler = fsrs({
    request_retention: retention,
    enable_fuzz: fuzz,
    enable_short_term: true,
  })
  return {
    outcomes(schedule, now) {
      const preview = scheduler.repeat(toFsrs(schedule), now)
      return {
        1: fromFsrs(preview[1].card),
        2: fromFsrs(preview[2].card),
        3: fromFsrs(preview[3].card),
        4: fromFsrs(preview[4].card),
      }
    },
  }
}
