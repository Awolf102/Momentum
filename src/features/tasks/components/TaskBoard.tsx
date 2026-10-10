import { Fragment, useRef, useState, type DragEvent } from 'react'
import { GlassCard } from '@/components/GlassCard'
import { cn } from '@/lib/cn'
import type { DateKey } from '@/lib/date'
import { boardColumns, COLUMNS } from '../lib/board'
import { editTask } from '../store'
import { moveTask } from '../tasks'
import type { Task, TaskStatus } from '../types'
import { TaskCheckbox } from './TaskCheckbox'
import { TaskMeta } from './TaskMeta'

/** Where a dragged card would land: before a card, or (null) at the end. */
type DropTarget = { status: TaskStatus; beforeId: string | null }

/**
 * To do, Doing, Done. Drag cards between and within columns; on a phone (or
 * from the keyboard) open a card to change its column.
 */
export function TaskBoard({
  tasks,
  today,
}: {
  tasks: readonly Task[]
  today: DateKey
}) {
  const columns = boardColumns(tasks)
  const [dragging, setDragging] = useState<string | null>(null)
  const [target, setTarget] = useState<DropTarget | null>(null)
  const reset = () => {
    setDragging(null)
    setTarget(null)
  }
  return (
    <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-3 sm:mx-0 sm:grid sm:snap-none sm:grid-cols-3 sm:gap-4 sm:overflow-visible sm:px-0 sm:pb-0">
      {COLUMNS.map(({ status, label }) => (
        <BoardColumn
          key={status}
          status={status}
          label={label}
          tasks={columns[status]}
          today={today}
          dragging={dragging}
          target={target?.status === status ? target.beforeId : undefined}
          onDragStart={setDragging}
          onTarget={(beforeId) => setTarget({ status, beforeId })}
          onDrop={() => {
            if (dragging && target?.status === status)
              void moveTask(dragging, status, target.beforeId)
            reset()
          }}
          onDragEnd={reset}
        />
      ))}
    </div>
  )
}

interface ColumnProps {
  status: TaskStatus
  label: string
  tasks: Task[]
  today: DateKey
  dragging: string | null
  /** `undefined` when the card isn't over this column. */
  target: string | null | undefined
  onDragStart: (id: string) => void
  onTarget: (beforeId: string | null) => void
  onDrop: () => void
  onDragEnd: () => void
}

function BoardColumn({
  status,
  label,
  tasks,
  today,
  dragging,
  target,
  onDragStart,
  onTarget,
  onDrop,
  onDragEnd,
}: ColumnProps) {
  const list = useRef<HTMLOListElement>(null)
  // Done keeps growing: the latest are enough unless asked.
  const [limit, setLimit] = useState(status === 'done' ? 8 : Infinity)
  const shown = tasks.slice(0, limit)

  /** The card the pointer is above the middle of: the drop goes before it. */
  function beforeIdAt(clientY: number): string | null {
    const cards =
      list.current?.querySelectorAll<HTMLElement>('[data-task-id]') ?? []
    for (const card of cards) {
      const { top, height } = card.getBoundingClientRect()
      if (clientY < top + height / 2) return card.dataset.taskId ?? null
    }
    return null
  }

  function onDragOver(event: DragEvent) {
    if (!dragging) return
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
    const beforeId = beforeIdAt(event.clientY)
    if (beforeId !== target) onTarget(beforeId)
  }

  return (
    <GlassCard
      aria-label={label}
      onDragOver={onDragOver}
      onDrop={(event: DragEvent) => {
        event.preventDefault()
        onDrop()
      }}
      className={cn(
        'flex w-[85%] shrink-0 snap-center flex-col p-3 transition sm:w-auto',
        target !== undefined && 'ring-1 ring-orange-300/40',
      )}
    >
      <h2 className="flex items-center justify-between px-2 pt-1 pb-2.5 text-xs font-semibold tracking-[0.2em] text-fg-muted uppercase">
        {label}
        <span className="font-medium tracking-normal text-fg-subtle tabular-nums">
          {tasks.length}
        </span>
      </h2>
      <ol ref={list} className="flex min-h-20 flex-col gap-2">
        {shown.map((task) => (
          <Fragment key={task.id}>
            {/* Done sorts itself (newest first), so there's no place to show. */}
            {target === task.id && status !== 'done' && <DropLine />}
            <TaskCard
              task={task}
              today={today}
              dragging={dragging === task.id}
              onDragStart={() => onDragStart(task.id)}
              onDragEnd={onDragEnd}
            />
          </Fragment>
        ))}
        {target === null && status !== 'done' && <DropLine />}
        {tasks.length === 0 && target === undefined && (
          <li className="grid min-h-16 place-items-center rounded-2xl border border-dashed border-line px-3 text-center text-xs text-fg-subtle">
            {status === 'doing'
              ? 'Drag what you’re working on here'
              : status === 'done'
                ? 'Finished tasks land here'
                : 'Nothing to do'}
          </li>
        )}
      </ol>
      {tasks.length > shown.length && (
        <button
          type="button"
          onClick={() => setLimit(Infinity)}
          className="mt-2 self-center rounded-full px-3 py-1.5 text-xs font-semibold text-fg-muted transition hover:bg-tint"
        >
          Show all {tasks.length}
        </button>
      )}
    </GlassCard>
  )
}

function DropLine() {
  return <li aria-hidden="true" className="h-0.5 rounded-full bg-orange-300" />
}

function TaskCard({
  task,
  today,
  dragging,
  onDragStart,
  onDragEnd,
}: {
  task: Task
  today: DateKey
  dragging: boolean
  onDragStart: () => void
  onDragEnd: () => void
}) {
  const done = task.status === 'done'
  return (
    <li
      data-task-id={task.id}
      draggable
      onDragStart={(event) => {
        event.dataTransfer.effectAllowed = 'move'
        event.dataTransfer.setData('text/plain', task.id)
        onDragStart()
      }}
      onDragEnd={onDragEnd}
      className={cn(
        'flex cursor-grab items-start gap-2.5 rounded-2xl bg-tint p-3 transition active:cursor-grabbing',
        dragging && 'opacity-40',
      )}
    >
      <TaskCheckbox task={task} className="mt-px" />
      <button
        type="button"
        onClick={() => editTask(task.id)}
        className="min-w-0 flex-1 rounded-lg text-left"
      >
        <span
          className={cn(
            'block text-sm leading-snug break-words',
            done && 'text-fg-subtle line-through decoration-fg-subtle/50',
          )}
        >
          {task.title}
        </span>
        <TaskMeta task={task} today={today} className="mt-1" />
      </button>
    </li>
  )
}
