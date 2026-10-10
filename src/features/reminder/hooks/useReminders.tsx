import { useEffect, useRef } from 'react'
import { BellIcon } from '@/components/icons'
import { toDateKey, type DateKey } from '@/lib/date'
import { canNotify, notify } from '@/lib/notify'
import { useStore } from '@/lib/store'
import { toast } from '@/lib/toast'
import { readMirror, writeMirror } from '../lib/mirror'
import {
  msUntilReminder,
  REMINDER_TAG,
  reminderDue,
  reminderMessage,
} from '../lib/schedule'
import { reminderStore } from '../store'

interface Current {
  time: string
  streak: number
  lastCheckIn: DateKey | null
}

async function remind(current: Current) {
  // The app's own state is freshest; the mirror only adds `lastNotified`.
  const stored = await readMirror()
  const state = { lastNotified: null, ...stored, ...current, enabled: true }
  const now = new Date()
  if (!reminderDue(state, now)) return
  await writeMirror({ lastNotified: toDateKey(now) })
  const { title, body } = reminderMessage(state.streak)

  // If Momentum is on screen, a gentle toast beats a system notification.
  if (document.visibilityState === 'visible') {
    toast({
      icon: <BellIcon className="text-orange-300" />,
      title,
      description: body,
      duration: 10_000,
    })
    return
  }
  await notify(title, {
    body,
    tag: REMINDER_TAG,
    actions: [{ action: 'check-in', title: 'Check in' }],
  })
}

/**
 * Keeps the service worker's copy of the reminder state up to date, and fires
 * the evening reminder while Momentum is open (even in a background tab).
 */
export function useReminders({
  streak,
  lastCheckIn,
}: {
  streak: number
  lastCheckIn: DateKey | null
}): void {
  const { enabled, time } = useStore(reminderStore)
  const latest = useRef<Current>({ time, streak, lastCheckIn })
  useEffect(() => {
    latest.current = { time, streak, lastCheckIn }
  })

  useEffect(() => {
    void writeMirror({ enabled, time, streak, lastCheckIn }).catch(() => {})
  }, [enabled, time, streak, lastCheckIn])

  useEffect(() => {
    if (!enabled || !canNotify()) return
    let timer: ReturnType<typeof setTimeout>
    const schedule = () => {
      timer = setTimeout(
        () => {
          void remind(latest.current)
          schedule()
        },
        msUntilReminder(time, new Date()) + 1000,
      )
    }
    schedule()
    // Opening Momentum after the reminder time counts too: you get a gentle
    // toast (once a day) instead of a notification.
    void remind(latest.current)
    const onVisible = () => {
      if (document.visibilityState === 'visible') void remind(latest.current)
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearTimeout(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [enabled, time])
}
