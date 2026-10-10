import {
  pause as pauseAmbience,
  play as playAmbience,
  playingStore,
} from '@/features/ambience'
import { liveSubjects, subjectsStore } from '@/features/subjects'
import { createId } from '@/lib/id'
import { primeChime } from './lib/chime'
import * as timer from './lib/timer'
import { focusSettingsStore, focusTimerStore, setFocusSubject } from './store'

const durations = () => timer.durationsFrom(focusSettingsStore.get())

/**
 * With "ambient sound while focusing" on, the mix plays while a focus session
 * runs and stops for breaks and pauses. Sound only starts from a click or key
 * press, so a session resumed after a reload starts silent.
 */
export function syncAmbience(): void {
  if (!focusSettingsStore.get().autoAmbience) return
  const phase = focusTimerStore.get().phase
  const focusing = phase?.kind === 'focus' && phase.pausedAt === null
  if (focusing && !playingStore.get()) playAmbience()
  else if (!focusing && playingStore.get()) pauseAmbience()
}

/** The chosen subject if it still exists, otherwise the first one (or none). */
function currentSubject(): string | null {
  const subjects = liveSubjects(subjectsStore.get())
  const chosen = focusSettingsStore.get().subjectId
  return (
    subjects.find((subject) => subject.id === chosen)?.id ??
    subjects[0]?.id ??
    null
  )
}

export function startFocus(subjectId: string | null = currentSubject()): void {
  primeChime()
  if (subjectId !== focusSettingsStore.get().subjectId)
    setFocusSubject(subjectId)
  focusTimerStore.set((state) =>
    timer.start(state, {
      id: createId(),
      subjectId,
      now: Date.now(),
      durations: durations(),
    }),
  )
  syncAmbience()
}

export function pauseFocus(): void {
  focusTimerStore.set((state) => timer.pause(state, Date.now()))
  syncAmbience()
}

export function resumeFocus(): void {
  primeChime()
  focusTimerStore.set((state) => timer.resume(state, Date.now()))
  syncAmbience()
}

/** Abandons the current focus session; it doesn't count. */
export function cancelFocus(): void {
  focusTimerStore.set((state) => timer.cancel(state, Date.now()))
  syncAmbience()
}

/** Ends the break and starts the next session now. */
export function skipBreak(): void {
  primeChime()
  focusTimerStore.set((state) =>
    timer.skipBreak(state, {
      id: createId(),
      subjectId: currentSubject(),
      now: Date.now(),
      durations: durations(),
    }),
  )
  syncAmbience()
}

/** One key (F) for everything: start, pause or resume. */
export function toggleFocus(): void {
  const phase = focusTimerStore.get().phase
  if (!phase) startFocus()
  else if (phase.pausedAt === null) pauseFocus()
  else resumeFocus()
}
