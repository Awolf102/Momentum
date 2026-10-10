import { motion } from 'motion/react'
import { cn } from '@/lib/cn'
import type { DateKey } from '@/lib/date'
import { editTask } from '../store'
import type { Task } from '../types'
import { TaskCheckbox } from './TaskCheckbox'
import { TaskMeta } from './TaskMeta'

/** A task in a list: tick it off, or tap it to edit. */
export function TaskRow({ task, today }: { task: Task; today: DateKey }) {
  const done = task.status === 'done'
  return (
    <motion.li
      layout="position"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.15 } }}
      transition={{ type: 'spring', stiffness: 500, damping: 40 }}
      className="flex items-start gap-3 py-2.5"
    >
      <TaskCheckbox task={task} className="mt-0.5" />
      <button
        type="button"
        onClick={() => editTask(task.id)}
        className="min-w-0 flex-1 rounded-lg text-left"
      >
        <span
          className={cn(
            'block text-[15px] leading-snug break-words',
            done && 'text-fg-subtle line-through decoration-fg-subtle/50',
          )}
        >
          {task.title}
        </span>
        <TaskMeta task={task} today={today} className="mt-1" />
      </button>
    </motion.li>
  )
}
