import { RepeatIcon } from '@/components/icons'
import { toDateKey } from '@/lib/date'
import { toast } from '@/lib/toast'
import { dueInSentence } from './lib/format'
import { completeTask, reopenTask } from './tasks'
import type { Task } from './types'

/** Ticks a task off (or back on). A repeating one says when it's next due. */
export async function toggleDone(task: Task): Promise<void> {
  if (task.status === 'done') {
    await reopenTask(task.id)
    return
  }
  const next = await completeTask(task.id)
  if (next?.due) {
    toast({
      id: `task-next-${task.seriesId}`,
      icon: <RepeatIcon className="text-orange-300" />,
      title: `${task.title}: next due ${dueInSentence(next.due, toDateKey(new Date()))}`,
      duration: 3500,
    })
  }
}
