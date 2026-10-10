import { useId, useMemo, useState, type FormEvent } from 'react'
import { PlusIcon } from '@/components/icons'
import { cn } from '@/lib/cn'
import { useQuickAddOptions } from '../hooks/useTasks'
import { parseQuickAdd } from '../lib/quickAdd'
import { addTask } from '../tasks'
import type { Task } from '../types'
import { TaskMeta } from './TaskMeta'

interface QuickAddProps {
  autoFocus?: boolean
  onAdded?: (task: Task) => void
  className?: string
}

/**
 * One line in, one task out: "Lab report fri 5pm #calculus !high". What it
 * understood shows underneath before you press Enter.
 */
export function QuickAdd({ autoFocus, onAdded, className }: QuickAddProps) {
  const [text, setText] = useState('')
  const options = useQuickAddOptions()
  const previewId = useId()
  const parsed = useMemo(
    () => (text.trim() ? parseQuickAdd(text, options) : null),
    [text, options],
  )
  const understood =
    parsed &&
    (parsed.due || parsed.subjectId || parsed.priority > 0 || parsed.recurrence)

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!parsed) return
    const task = await addTask(parsed)
    if (!task) return
    setText('')
    onAdded?.(task)
  }

  return (
    <form
      onSubmit={(event) => void submit(event)}
      className={cn(
        'rounded-2xl bg-tint ring-1 ring-transparent transition focus-within:ring-orange-300/50',
        className,
      )}
    >
      <div className="flex items-center gap-2 py-1 pr-1 pl-3.5">
        <PlusIcon className="shrink-0 text-base text-fg-subtle" />
        <input
          value={text}
          onChange={(event) => setText(event.target.value)}
          autoFocus={autoFocus}
          placeholder="Add a task… e.g. Lab report fri"
          aria-label="New task"
          aria-describedby={understood ? previewId : undefined}
          enterKeyHint="done"
          maxLength={400}
          className="h-10 min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-fg-subtle focus-visible:outline-none"
        />
        <button
          type="submit"
          disabled={!parsed}
          className="rounded-xl bg-linear-to-br from-amber-300 to-orange-500 px-3.5 py-2 text-xs font-semibold text-orange-950 transition disabled:opacity-0"
        >
          Add
        </button>
      </div>
      {understood && (
        <div
          id={previewId}
          className="flex items-center gap-2 border-t border-line px-3.5 py-2"
        >
          <span className="text-xs text-fg-muted">{parsed.title}</span>
          <TaskMeta task={parsed} today={options.today} showPriority />
        </div>
      )}
    </form>
  )
}
