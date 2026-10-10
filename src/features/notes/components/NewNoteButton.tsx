import { PlusIcon } from '@/components/icons'
import { cn } from '@/lib/cn'
import { startNote } from '../actions'

export function NewNoteButton({ className }: { className?: string }) {
  return (
    <button
      type="button"
      onClick={() => void startNote()}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full bg-linear-to-br from-amber-300 to-orange-500 px-4 py-2 text-sm font-semibold text-orange-950 shadow-[0_10px_24px_-12px_rgb(249_115_22/0.8)] transition-shadow hover:shadow-[0_12px_28px_-10px_rgb(249_115_22/0.9)]',
        className,
      )}
    >
      <PlusIcon /> New note
    </button>
  )
}
