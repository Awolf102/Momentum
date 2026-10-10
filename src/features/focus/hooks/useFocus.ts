import { liveSubjects, subjectsStore } from '@/features/subjects'
import { useStore } from '@/lib/store'
import { durationsFrom } from '../lib/timer'
import { focusSettingsStore, focusTimerStore } from '../store'
import { useNow } from './useNow'

/** Everything the timer UI shows, ticking once a second while running. */
export function useFocus() {
  const timer = useStore(focusTimerStore)
  const settings = useStore(focusSettingsStore)
  const subjects = liveSubjects(useStore(subjectsStore))
  const phase = timer.phase
  const now = useNow(phase !== null && phase.pausedAt === null)
  // The chosen subject if it still exists, otherwise the first one.
  const subjectId =
    subjects.find((subject) => subject.id === settings.subjectId)?.id ??
    subjects[0]?.id ??
    null
  return {
    timer,
    phase,
    now,
    settings,
    durations: durationsFrom(settings),
    subjects,
    subjectId,
  }
}
