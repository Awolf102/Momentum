import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useId, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { CloseIcon } from './icons'
import { IconButton } from './IconButton'
import { useMediaQuery } from '@/lib/useMediaQuery'

interface SheetProps {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
}

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])'

/**
 * A modal panel: slides in from the right on larger screens and up from the
 * bottom on phones. Traps focus, closes on Escape, restores focus on close.
 */
export function Sheet({ open, onClose, title, children }: SheetProps) {
  const isWide = useMediaQuery('(min-width: 640px)')
  const panelRef = useRef<HTMLDivElement>(null)
  const titleId = useId()

  useEffect(() => {
    if (!open) return
    const previouslyFocused = document.activeElement as HTMLElement | null
    const { overflow } = document.body.style
    document.body.style.overflow = 'hidden'
    panelRef.current?.focus()

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
        return
      }
      if (event.key !== 'Tab' || !panelRef.current) return
      const focusable = [
        ...panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE),
      ]
      if (focusable.length === 0) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = overflow
      previouslyFocused?.focus()
    }
  }, [open, onClose])

  const hidden = isWide ? { x: '105%' } : { y: '100%' }

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50">
          <motion.div
            className="absolute inset-0 bg-black/40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            tabIndex={-1}
            initial={hidden}
            animate={{ x: 0, y: 0 }}
            exit={hidden}
            transition={{ type: 'spring', stiffness: 380, damping: 38 }}
            className="absolute inset-x-0 bottom-0 flex max-h-[88dvh] flex-col rounded-t-[28px] glass-strong outline-none sm:inset-y-3 sm:right-3 sm:left-auto sm:max-h-none sm:w-[420px] sm:rounded-[28px]"
          >
            <div className="flex items-center justify-between px-6 pt-5 pb-3">
              <h2 id={titleId} className="text-lg font-semibold tracking-tight">
                {title}
              </h2>
              <IconButton
                label="Close"
                onClick={onClose}
                className="size-9 text-base"
              >
                <CloseIcon />
              </IconButton>
            </div>
            <div className="flex-1 overflow-y-auto px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
              {children}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  )
}
