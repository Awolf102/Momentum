import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { ChecklistIcon } from '@/components/icons'
import { Kbd } from '@/components/Kbd'
import { useStore } from '@/lib/store'
import { toast } from '@/lib/toast'
import { closeQuickAdd, quickAddOpenStore } from '../store'
import { QuickAdd } from './QuickAdd'

const HINTS: [string, string][] = [
  ['When', 'today, tomorrow, fri, next week, 12 Oct, 5pm'],
  ['Subject', '#calculus'],
  ['Priority', '! low, !! medium, !!! high'],
  ['Repeat', 'every monday, daily, every 2 weeks'],
]

/** Add a task from anywhere (N). */
export function QuickAddDialog() {
  const open = useStore(quickAddOpenStore)
  return createPortal(
    <AnimatePresence>{open && <Dialog />}</AnimatePresence>,
    document.body,
  )
}

function Dialog() {
  const panel = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        closeQuickAdd()
        return
      }
      // Tab stays inside the dialog.
      if (event.key !== 'Tab' || !panel.current) return
      const focusable = [
        ...panel.current.querySelectorAll<HTMLElement>(
          'input, button:not([disabled])',
        ),
      ]
      const first = focusable[0]
      const last = focusable.at(-1)
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last?.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first?.focus()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      previouslyFocused?.focus()
    }
  }, [])

  return (
    <div className="fixed inset-0 z-50 flex justify-center px-3 pt-[12vh]">
      <motion.div
        className="absolute inset-0 bg-black/40"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={closeQuickAdd}
      />
      <motion.div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label="Add a task"
        initial={{ opacity: 0, y: -12, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{
          opacity: 0,
          y: -8,
          scale: 0.98,
          transition: { duration: 0.12 },
        }}
        transition={{ type: 'spring', stiffness: 500, damping: 36 }}
        className="relative h-fit w-full max-w-lg rounded-3xl glass-strong p-3"
      >
        <div className="flex items-center justify-between px-2 pt-1 pb-3">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <ChecklistIcon className="text-base text-fg-muted" />
            Add a task
          </h2>
          <Kbd keys={['esc']} />
        </div>
        <QuickAdd
          autoFocus
          onAdded={(task) => {
            closeQuickAdd()
            toast({
              id: 'task-added',
              icon: <ChecklistIcon className="text-orange-300" />,
              title: 'Task added',
              description: task.title,
              duration: 2500,
            })
          }}
        />
        <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 px-2 pb-1 text-xs">
          {HINTS.map(([term, example]) => (
            <div key={term} className="contents">
              <dt className="text-fg-subtle">{term}</dt>
              <dd className="text-fg-muted">{example}</dd>
            </div>
          ))}
        </dl>
      </motion.div>
    </div>
  )
}
