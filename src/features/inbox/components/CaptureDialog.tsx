import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { InboxIcon } from '@/components/icons'
import { Kbd } from '@/components/Kbd'
import { navigate, paths } from '@/lib/routes'
import { useStore } from '@/lib/store'
import { toast } from '@/lib/toast'
import { captureOpenStore, closeCapture } from '../store'
import { CaptureField } from './CaptureField'

/** Capture from anywhere (I), sorted later in the inbox. */
export function CaptureDialog() {
  const open = useStore(captureOpenStore)
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
        closeCapture()
        return
      }
      if (event.key !== 'Tab' || !panel.current) return
      const focusable = [
        ...panel.current.querySelectorAll<HTMLElement>(
          'textarea, button:not([disabled])',
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
        onClick={closeCapture}
      />
      <motion.div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label="Capture to inbox"
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
            <InboxIcon className="text-base text-fg-muted" />
            Capture to inbox
          </h2>
          <Kbd keys={['esc']} />
        </div>
        <CaptureField
          autoFocus
          onCaptured={() => {
            closeCapture()
            toast({
              id: 'captured',
              icon: <InboxIcon className="text-orange-300" />,
              title: 'Saved to your inbox',
              description: 'Sort it when you have a moment.',
              duration: 3000,
              action: { label: 'Open', run: () => navigate(paths.inbox) },
            })
          }}
        />
        <p className="px-2 pt-2.5 text-xs text-fg-subtle">
          It waits in the inbox until you make it a task, add it to today's log,
          or let it go.
        </p>
      </motion.div>
    </div>
  )
}
