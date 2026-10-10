import { daysBetween, formatDateKey, type DateKey } from '@/lib/date'

/** "Today", "Tomorrow", "Yesterday", "Friday", "12 Oct", "12 Oct 2027". */
export function formatDue(due: DateKey, today: DateKey): string {
  const days = daysBetween(today, due)
  if (days === 0) return 'Today'
  if (days === 1) return 'Tomorrow'
  if (days === -1) return 'Yesterday'
  if (days > 1 && days < 7) return formatDateKey(due, { weekday: 'long' })
  return formatDateKey(due, {
    day: 'numeric',
    month: 'short',
    ...(due.slice(0, 4) === today.slice(0, 4) ? {} : { year: 'numeric' }),
  })
}

/** The due date inside a sentence: "next due tomorrow", "next due Friday". */
export function dueInSentence(due: DateKey, today: DateKey): string {
  const text = formatDue(due, today)
  return ['Today', 'Tomorrow', 'Yesterday'].includes(text)
    ? text.toLowerCase()
    : text
}

const timeFormat = new Intl.DateTimeFormat(undefined, {
  hour: 'numeric',
  minute: '2-digit',
})

/** "17:00" → "5:00 pm" (or "17:00", as the user's locale writes it). */
export function formatTime(time: string): string {
  const [hours, minutes] = time.split(':').map(Number)
  return timeFormat.format(new Date(2000, 0, 1, hours, minutes))
}

export const PRIORITY_NAMES = ['No priority', 'Low', 'Medium', 'High'] as const
