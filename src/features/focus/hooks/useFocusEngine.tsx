import { useEffect } from 'react'
import { TimerIcon } from '@/components/icons'
import { findSubject } from '@/features/subjects'
import { checkIn } from '@/features/streak'
import { toDateKey } from '@/lib/date'
import { notify } from '@/lib/notify'
import { useStore } from '@/lib/store'
import { toast } from '@/lib/toast'
import { syncAmbience } from '../actions'
import { settle, type Completion } from '../engine'
import { playChime } from '../lib/chime'
import { formatCountdown, PHASE_NAMES } from '../lib/format'
import {
  durationsFrom,
  remainingMs,
  scheduledEnd,
  sessionNumber,
} from '../lib/timer'
import { focusSessions } from '../sessions'
import { focusSettingsStore, focusTimerStore } from '../store'

const deps = {
  timer: focusTimerStore,
  durations: () => durationsFrom(focusSettingsStore.get()),
  record: focusSessions.add,
  checkIn: (at: Date, day: string) => checkIn(at, { day }),
}

/** Anything that ended more than this long ago happened while you were away. */
const FRESH_MS = 90_000
const TAG = 'momentum-focus'

function messageFor(completion: Completion): { title: string; body: string } {
  const { phase, session, checkedIn } = completion
  if (phase.kind !== 'focus') {
    return {
      title: "Break's over",
      body: `Ready for session ${sessionNumber(focusTimerStore.get())}?`,
    }
  }
  const subject = findSubject(session?.subjectId)?.name
  const minutes = Math.round(phase.durationMs / 60_000)
  const next = focusTimerStore.get().phase
  const breakText = next
    ? ` Time for a ${PHASE_NAMES[next.kind].toLowerCase()}.`
    : ''
  const checked =
    checkedIn && session?.day === toDateKey(new Date())
      ? " You're checked in for today."
      : ''
  return {
    title: 'Focus session complete',
    body: `${minutes} min${subject ? ` of ${subject}` : ''}.${breakText}${checked}`,
  }
}

function announce(completions: Completion[]) {
  const now = Date.now()
  const mine = completions.filter((completion) => completion.recorded)
  if (mine.length === 0) return
  if (mine.some((completion) => completion.phase.kind === 'focus'))
    syncAmbience()

  const latest = mine.at(-1)!
  if (now - latest.endedAt < FRESH_MS) {
    playChime(latest.phase.kind === 'focus' ? 'focus-done' : 'break-done')
    const { title, body } = messageFor(latest)
    // On screen, a toast; otherwise a system notification (if allowed).
    if (document.visibilityState === 'visible') {
      toast({
        id: TAG,
        icon: <TimerIcon className="text-orange-300" />,
        title,
        description: body,
        duration: 8000,
      })
    } else {
      void notify(title, { body, tag: TAG })
    }
    return
  }

  // Finished while Momentum was closed: say so once, quietly.
  const sessions = mine.filter((completion) => completion.session)
  if (sessions.length === 0) return
  const endedAt = new Date(sessions.at(-1)!.endedAt).toLocaleTimeString(
    undefined,
    {
      hour: 'numeric',
      minute: '2-digit',
    },
  )
  const checked = sessions.some((completion) => completion.checkedIn)
  toast({
    id: TAG,
    icon: <TimerIcon className="text-orange-300" />,
    title:
      sessions.length === 1
        ? 'Your focus session finished while you were away'
        : `${sessions.length} focus sessions finished while you were away`,
    description: `Recorded at ${endedAt}.${checked ? ' It checked you in for the day.' : ''}`,
    duration: 10_000,
  })
}

let settling: Promise<void> = Promise.resolve()

/** Ends whatever is due, one settle at a time. */
function runSettle(): Promise<void> {
  settling = settling.then(async () => announce(await settle(deps, Date.now())))
  return settling
}

/**
 * Runs the timer for the whole app: catches up on load (a session that ended
 * while Momentum was closed is recorded at its scheduled end), wakes exactly
 * when the current phase is due, rechecks whenever the tab becomes visible,
 * and keeps the countdown in the tab title.
 */
export function useFocusEngine(): void {
  const { phase } = useStore(focusTimerStore)

  useEffect(() => {
    void runSettle()
    const end = phase ? scheduledEnd(phase) : null
    const timer =
      end === null
        ? undefined
        : setTimeout(() => void runSettle(), Math.max(0, end - Date.now()) + 30)
    const onWake = () => {
      if (document.visibilityState === 'visible') void runSettle()
    }
    document.addEventListener('visibilitychange', onWake)
    window.addEventListener('focus', onWake)
    return () => {
      clearTimeout(timer)
      document.removeEventListener('visibilitychange', onWake)
      window.removeEventListener('focus', onWake)
    }
  }, [phase])

  useEffect(() => {
    if (!phase) return
    const base = 'Momentum'
    const update = () => {
      const label = phase.pausedAt === null ? PHASE_NAMES[phase.kind] : 'Paused'
      document.title = `${formatCountdown(remainingMs(phase, Date.now()))} · ${label} — ${base}`
    }
    update()
    const interval =
      phase.pausedAt === null ? setInterval(update, 1000) : undefined
    return () => {
      clearInterval(interval)
      document.title = base
    }
  }, [phase])
}
