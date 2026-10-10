import { AnimatePresence, motion } from 'motion/react'
import { useEffect } from 'react'
import { useStore } from '@/lib/store'
import { dismissToast, toastStore, type Toast } from '@/lib/toast'
import { CloseIcon } from './icons'

/** Renders toasts at the bottom of the screen. */
export function Toaster() {
  const toasts = useStore(toastStore)
  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-[60] flex flex-col items-center gap-2 px-4 pb-[calc(max(0.75rem,env(safe-area-inset-bottom))+4.75rem)] lg:pb-4 lg:pl-[17.25rem]"
    >
      <AnimatePresence initial={false}>
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} />
        ))}
      </AnimatePresence>
    </div>
  )
}

function ToastItem({ toast }: { toast: Toast }) {
  useEffect(() => {
    if (!Number.isFinite(toast.duration)) return
    const timer = setTimeout(() => dismissToast(toast.id), toast.duration)
    return () => clearTimeout(timer)
  }, [toast.id, toast.duration])

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 16, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 8, scale: 0.96, transition: { duration: 0.15 } }}
      transition={{ type: 'spring', stiffness: 420, damping: 32 }}
      className="pointer-events-auto flex w-full max-w-sm items-center gap-3 rounded-2xl glass-strong py-3 pr-2 pl-4"
    >
      {toast.icon && <span className="shrink-0 text-xl">{toast.icon}</span>}
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">{toast.title}</p>
        {toast.description && (
          <p className="mt-0.5 text-xs text-fg-muted">{toast.description}</p>
        )}
      </div>
      {toast.action && (
        <button
          type="button"
          onClick={() => {
            toast.action?.run()
            dismissToast(toast.id)
          }}
          className="shrink-0 rounded-full bg-tint px-3 py-1.5 text-xs font-semibold transition hover:bg-line"
        >
          {toast.action.label}
        </button>
      )}
      <button
        type="button"
        aria-label="Dismiss"
        onClick={() => dismissToast(toast.id)}
        className="flex size-7 shrink-0 items-center justify-center rounded-full text-sm text-fg-subtle transition hover:bg-tint hover:text-fg"
      >
        <CloseIcon />
      </button>
    </motion.div>
  )
}
