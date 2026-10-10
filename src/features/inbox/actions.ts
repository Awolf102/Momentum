import { lineFor, setLine } from '@/features/log'
import { liveSubjects, subjectsStore } from '@/features/subjects'
import { addTask, parseQuickAdd, type Task } from '@/features/tasks'
import { toDateKey } from '@/lib/date'
import { dayFirst } from '@/lib/locale'
import { dismiss } from './items'
import type { InboxItem } from './types'

/**
 * Turns an item into a task, read like quick add ("Email tutor fri #calculus"
 * gets its date and subject), keeping any link in the title.
 */
export async function makeTask(item: InboxItem): Promise<Task | null> {
  const text =
    item.url && !item.text.includes(item.url)
      ? `${item.text} ${item.url}`
      : item.text
  const task = await addTask(
    parseQuickAdd(text, {
      today: toDateKey(new Date()),
      subjects: liveSubjects(subjectsStore.get()),
      dayFirst,
    }),
  )
  if (task) await dismiss(item.id)
  return task
}

/** Adds an item to today's log line (after what's there). */
export async function addToLog(item: InboxItem): Promise<void> {
  const today = toDateKey(new Date())
  const line = lineFor(today)
  await setLine(today, line ? `${line} · ${item.text}` : item.text)
  await dismiss(item.id)
}
