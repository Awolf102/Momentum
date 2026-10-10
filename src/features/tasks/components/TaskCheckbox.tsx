import { motion } from 'motion/react'
import { CheckIcon } from '@/components/icons'
import { cn } from '@/lib/cn'
import { toggleDone } from '../actions'
import { PRIORITY_NAMES } from '../lib/format'
import type { Task } from '../types'

/** The ring's colour says how important it is. */
const RINGS = [
  'ring-fg-subtle',
  'ring-sky-300 light:ring-sky-500',
  'ring-amber-300 light:ring-amber-500',
  'ring-rose-400 light:ring-rose-500',
]

export function TaskCheckbox({
  task,
  className,
}: {
  task: Task
  className?: string
}) {
  const done = task.status === 'done'
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={done}
      aria-label={`${task.title}${task.priority ? ` (${PRIORITY_NAMES[task.priority].toLowerCase()} priority)` : ''}`}
      onClick={(event) => {
        event.stopPropagation()
        void toggleDone(task)
      }}
      className={cn(
        'relative grid size-[1.375rem] shrink-0 place-items-center rounded-full ring-[1.5px] transition hover:bg-tint',
        done
          ? 'bg-orange-400 text-orange-950 ring-orange-400'
          : RINGS[task.priority],
        className,
      )}
    >
      {done && (
        <motion.span
          initial={{ scale: 0.4, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 520, damping: 22 }}
        >
          <CheckIcon strokeWidth={3} className="text-xs" />
        </motion.span>
      )}
    </button>
  )
}
