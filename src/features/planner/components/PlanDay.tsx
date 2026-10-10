import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type DragEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import { useLocation, useSearch } from 'wouter'
import { GlassCard } from '@/components/GlassCard'
import {
  CalendarIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChecklistIcon,
  PlusIcon,
} from '@/components/icons'
import { IconButton } from '@/components/IconButton'
import { Sheet } from '@/components/Sheet'
import { focusTimerStore, startFocus } from '@/features/focus'
import { toggleDone, type Task } from '@/features/tasks'
import { addDays, formatDateKey, isDateKey, type DateKey } from '@/lib/date'
import { useHotkeys } from '@/lib/hotkeys'
import { paths } from '@/lib/routes'
import { useStore } from '@/lib/store'
import { toast } from '@/lib/toast'
import { useClock } from '@/lib/useClock'
import { useMediaQuery } from '@/lib/useMediaQuery'
import { useToday } from '@/lib/useToday'
import {
  addBlock,
  importCalendar,
  removeBlock,
  removeCalendar,
  restoreBlock,
  restoreCalendar,
  updateBlock,
  updateCalendar,
} from '../actions'
import { usePlanDay } from '../hooks/usePlanDay'
import { CALENDAR_SWATCHES } from '../lib/colors'
import { IcsError } from '../lib/ics'
import {
  DAY_MINUTES,
  formatClock,
  formatLength,
  formatSpan,
  freeSlot,
} from '../lib/time'
import type { Block, Calendar } from '../types'
import { BlockSheet, type BlockFields, type Editing } from './BlockSheet'
import { CalendarsPanel } from './CalendarsPanel'
import { Timeline, type Preview, type TimelineHandle } from './Timeline'
import { ToPlan } from './ToPlan'

/** How long a task's block is when it's added. */
const TASK_LENGTH = 60
const pill =
  'inline-flex items-center gap-1.5 rounded-full bg-tint px-3.5 py-2 text-sm font-semibold transition hover:bg-line'

const plural = (count: number, word: string) =>
  `${count} ${word}${count === 1 ? '' : 's'}`

/**
 * A day of the plan: the timeline in the middle, tasks waiting for a time
 * and imported calendars beside it (in sheets on a phone).
 */
export function PlanDay() {
  const today = useToday()
  const [, navigate] = useLocation()
  const params = new URLSearchParams(useSearch())
  const wanted = params.get('day')
  const day: DateKey = isDateKey(wanted) ? wanted : today
  // From ⌘K "Import a calendar": the calendars, ready to import one.
  const askCalendars = params.get('calendars') === '1'
  const isToday = day === today
  const plan = usePlanDay(day)
  const clock = useClock()
  const nowMinutes = clock.getHours() * 60 + clock.getMinutes()
  const timer = useStore(focusTimerStore)
  const wide = useMediaQuery('(min-width: 1024px)')
  const timeline = useRef<TimelineHandle>(null)
  const [editing, setEditing] = useState<Editing | null>(null)
  const [sheet, setSheet] = useState<'tasks' | 'calendars' | null>(null)
  const [drag, setDrag] = useState<{
    title: string
    x: number
    y: number
    preview: Preview | null
  } | null>(null)
  const [said, setSaid] = useState('')
  const [dropping, setDropping] = useState(false)

  const goTo = (next: DateKey) =>
    navigate(next === today ? paths.plan : paths.planDay(next))
  useHotkeys([
    { key: 'ArrowLeft', run: () => goTo(addDays(day, -1)) },
    { key: 'ArrowRight', run: () => goTo(addDays(day, 1)) },
  ])

  // Open on what matters: the time now, or the day's first thing.
  const latest = useRef({ plan, isToday, nowMinutes })
  useLayoutEffect(() => {
    latest.current = { plan, isToday, nowMinutes }
  })
  useEffect(() => {
    const { plan, isToday, nowMinutes } = latest.current
    const starts = [
      ...plan.blocks.map((block) => block.start),
      ...plan.events.map((event) => event.start),
    ]
    const target = isToday ? nowMinutes - 60 : Math.min(8 * 60, ...starts) - 30
    timeline.current?.scrollTo(Math.max(0, target))
  }, [day])

  useEffect(() => {
    if (!askCalendars || !wide) return
    const panel = document.getElementById('plan-calendars')
    panel?.scrollIntoView({ block: 'nearest' })
    panel?.querySelector<HTMLButtonElement>('button[data-import]')?.focus()
  }, [askCalendars, wide])
  const openSheet = sheet ?? (askCalendars && !wide ? 'calendars' : null)
  function closeSheet() {
    setSheet(null)
    if (askCalendars)
      navigate(isToday ? paths.plan : paths.planDay(day), { replace: true })
  }

  const freeFrom = (length: number) => {
    const taken = [...plan.blocks, ...plan.events]
    return (
      freeSlot(taken, isToday ? nowMinutes : 9 * 60, length) ??
      freeSlot(taken, 0, length)
    )
  }

  function addTask(task: Task, at?: number) {
    const start = at ?? freeFrom(TASK_LENGTH)
    if (start === null) {
      toast({ title: 'There’s no free hour left that day.' })
      return
    }
    const end = Math.min(DAY_MINUTES, start + TASK_LENGTH)
    setSheet(null)
    timeline.current?.scrollTo(Math.max(0, start - 60))
    setSaid(`${task.title}: ${formatSpan(start, end)}`)
    void addBlock({
      day,
      start,
      end,
      kind: 'task',
      taskId: task.id,
      title: task.title,
      subjectId: task.subjectId,
    }).then((block) =>
      toast({
        title: `“${task.title}” at ${formatClock(start)}`,
        action: { label: 'Undo', run: () => void removeBlock(block.id) },
      }),
    )
  }

  /** A task dragged from the list onto the day (with a mouse). */
  function dragTask(task: Task, event: ReactPointerEvent<HTMLElement>) {
    event.preventDefault()
    const { pointerId } = event
    const origin = { x: event.clientX, y: event.clientY }
    let last = origin
    let moved = false
    let preview: Preview | null = null
    const update = () => {
      const minutes = timeline.current?.minutesAt(last.x, last.y) ?? null
      const start =
        minutes === null ? null : Math.min(DAY_MINUTES - TASK_LENGTH, minutes)
      preview =
        start === null
          ? null
          : { start, end: start + TASK_LENGTH, title: task.title }
      setDrag({ title: task.title, x: last.x, y: last.y, preview })
    }
    const onMove = (move: PointerEvent) => {
      if (move.pointerId !== pointerId) return
      last = { x: move.clientX, y: move.clientY }
      if (!moved && Math.hypot(last.x - origin.x, last.y - origin.y) < 5) return
      moved = true
      update()
      timeline.current?.edgeScroll(preview ? move.clientY : null, update)
    }
    const onUp = (up: PointerEvent) => {
      if (up.pointerId !== pointerId) return
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
      timeline.current?.edgeScroll(null)
      setDrag(null)
      if (up.type === 'pointerup' && preview) addTask(task, preview.start)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
  }

  function change(block: Block, start: number, end: number) {
    setSaid(`${plan.titleOf(block)}: ${formatSpan(start, end)}`)
    void updateBlock(block.id, { start, end })
  }

  function remove(block: Block) {
    const title = plan.titleOf(block)
    toast({
      title: `“${title}” taken off the plan`,
      action: { label: 'Undo', run: () => void restoreBlock(block.id) },
    })
    setSaid(`${title} removed`)
    void removeBlock(block.id)
  }

  function save(fields: BlockFields) {
    if (editing && 'block' in editing) {
      void updateBlock(editing.block.id, {
        title: fields.title,
        subjectId: fields.subjectId,
        start: fields.start,
        end: fields.end,
      })
      return
    }
    void addBlock({ day, ...fields })
    timeline.current?.scrollTo(Math.max(0, fields.start - 60))
  }

  function newBlock(start?: number) {
    const from = start ?? freeFrom(60) ?? 9 * 60
    setSheet(null)
    setEditing({
      draft: { day, start: from, end: Math.min(DAY_MINUTES, from + 60) },
    })
  }

  async function importFile(file: File, replacing?: Calendar) {
    try {
      const { calendar, parsed } = await importCalendar(file, replacing)
      const notes = [
        `${plural(parsed.events.length, 'event')}${parsed.repeating ? `, ${parsed.repeating} repeating` : ''}.`,
      ]
      if (parsed.unsupported)
        notes.push(
          `${parsed.unsupported} ${parsed.unsupported === 1 ? 'repeats' : 'repeat'} in a way Momentum can’t follow yet, so ${parsed.unsupported === 1 ? 'it’s' : 'they’re'} shown once.`,
        )
      if (parsed.cancelled)
        notes.push(`${parsed.cancelled} cancelled left out.`)
      if (parsed.skipped) notes.push(`${parsed.skipped} couldn’t be read.`)
      toast({
        title: `${replacing ? 'Updated' : 'Imported'} “${calendar.name}”`,
        description: notes.join(' '),
        duration: 8000,
      })
    } catch (error) {
      toast({
        title: 'That calendar couldn’t be imported',
        description:
          error instanceof IcsError
            ? error.message
            : 'The file couldn’t be read.',
        duration: 8000,
      })
    }
  }

  function dropCalendar(event: DragEvent<HTMLDivElement>) {
    if (!event.dataTransfer.types.includes('Files')) return
    event.preventDefault()
    setDropping(false)
    const file = [...event.dataTransfer.files].find(
      (each) =>
        /\.(ics|ical|icalendar)$/i.test(each.name) ||
        each.type === 'text/calendar',
    )
    if (file) void importFile(file)
    else
      toast({
        title: 'That calendar couldn’t be imported',
        description: 'Drop an .ics file.',
      })
  }

  const calendarProps = {
    onImport: (file: File, replacing?: Calendar) =>
      void importFile(file, replacing),
    onChange: (
      calendar: Calendar,
      changes: Partial<Pick<Calendar, 'name' | 'color' | 'hidden'>>,
    ) => void updateCalendar(calendar.id, changes),
    onRemove: (calendar: Calendar) => {
      toast({
        title: `“${calendar.name}” removed`,
        action: { label: 'Undo', run: () => void restoreCalendar(calendar.id) },
      })
      void removeCalendar(calendar.id)
    },
  }

  const planned = plan.blocks.reduce(
    (sum, block) => sum + block.end - block.start,
    0,
  )
  const dayName = formatDateKey(day, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })

  return (
    <div
      className="mx-auto flex w-full max-w-6xl flex-col pt-2 pb-8 sm:pt-6 lg:pt-2"
      onDragOver={(event) => {
        if (!event.dataTransfer.types.includes('Files')) return
        event.preventDefault()
        setDropping(true)
      }}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null))
          setDropping(false)
      }}
      onDrop={dropCalendar}
    >
      <h1 className="font-serif text-5xl leading-none tracking-tight text-shadow-soft sm:text-6xl">
        Plan
      </h1>
      <p className="mt-3 text-[15px] text-fg-muted text-shadow-soft">
        {plan.blocks.length > 0
          ? `${formatLength(planned)} planned${plan.events.length ? `, around ${plural(plan.events.length, 'event')}` : ''}.`
          : 'Nothing planned yet: pick a time on the day to add a block.'}
      </p>
      <div className="mt-5 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <h2
          className="text-lg font-semibold text-shadow-soft"
          aria-live="polite"
        >
          {dayName}
          {isToday && (
            <span className="ml-2 rounded-full bg-orange-400/20 px-2 py-0.5 align-middle text-xs font-semibold text-orange-200 light:text-orange-800">
              Today
            </span>
          )}
        </h2>
        <div className="flex items-center gap-2">
          <IconButton
            label="Previous day"
            onClick={() => goTo(addDays(day, -1))}
            className="size-9 text-base"
          >
            <ChevronLeftIcon />
          </IconButton>
          <button
            type="button"
            onClick={() => goTo(today)}
            disabled={isToday}
            className="h-9 rounded-full glass px-4 text-sm font-semibold transition disabled:opacity-50"
          >
            Today
          </button>
          <IconButton
            label="Next day"
            onClick={() => goTo(addDays(day, 1))}
            className="size-9 text-base"
          >
            <ChevronRightIcon />
          </IconButton>
        </div>
      </div>
      {plan.allDay.length > 0 && (
        <ul aria-label="All day" className="mt-3 flex flex-wrap gap-2">
          {plan.allDay.map((event) => (
            <li
              key={event.key}
              className="inline-flex max-w-full items-center gap-1.5 rounded-full glass px-3 py-1 text-xs font-medium"
            >
              <span
                className="size-2 shrink-0 rounded-full"
                style={{ background: CALENDAR_SWATCHES[event.color] }}
              />
              <span className="truncate">{event.title || 'Busy'}</span>
              <span className="text-fg-subtle">all day</span>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0">
          {!wide && (
            <div className="mb-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setSheet('tasks')}
                className={pill}
              >
                <ChecklistIcon /> To plan
                <span className="text-fg-subtle">{plan.toPlan.length}</span>
              </button>
              <button type="button" onClick={() => newBlock()} className={pill}>
                <PlusIcon /> Block
              </button>
              <button
                type="button"
                onClick={() => setSheet('calendars')}
                className={pill}
              >
                <CalendarIcon /> Calendars
              </button>
            </div>
          )}
          <Timeline
            ref={timeline}
            label={`The plan for ${dayName}`}
            blocks={plan.blocks}
            events={plan.events}
            sessions={plan.sessions}
            marks={plan.marks}
            now={isToday ? nowMinutes : null}
            preview={drag?.preview ?? null}
            titleOf={plan.titleOf}
            colorOf={plan.colorOf}
            isDone={(block) => plan.task(block.taskId)?.status === 'done'}
            canStart={(block) =>
              block.kind === 'focus' &&
              isToday &&
              timer.phase === null &&
              nowMinutes >= block.start - 30 &&
              nowMinutes < block.end
            }
            onCreate={(start) => newBlock(start)}
            onOpen={(block) => setEditing({ block })}
            onChange={change}
            onRemove={remove}
            onToggleTask={(block) => {
              const task = plan.task(block.taskId)
              if (task) void toggleDone(task)
            }}
            onStart={(block) => {
              startFocus(block.subjectId)
              toast({
                title: `Focusing: ${plan.titleOf(block)}`,
                description:
                  'The timer is running; it’s in the corner as you go.',
              })
            }}
          />
        </div>
        {wide && (
          <aside className="flex flex-col gap-4">
            <GlassCard className="p-4">
              <div className="mb-2 flex items-center justify-between gap-2">
                <h2 className="text-xs font-semibold tracking-[0.14em] text-fg-subtle uppercase">
                  To plan
                </h2>
                <button
                  type="button"
                  onClick={() => newBlock()}
                  className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold text-fg-muted transition hover:bg-tint hover:text-fg"
                >
                  <PlusIcon /> Block
                </button>
              </div>
              <ToPlan
                tasks={plan.toPlan}
                day={day}
                onAdd={(task) => addTask(task)}
                onDragStart={dragTask}
              />
            </GlassCard>
            <GlassCard id="plan-calendars" className="p-4">
              <h2 className="mb-2 text-xs font-semibold tracking-[0.14em] text-fg-subtle uppercase">
                Calendars
              </h2>
              <CalendarsPanel {...calendarProps} />
            </GlassCard>
          </aside>
        )}
      </div>

      <BlockSheet
        editing={editing}
        onClose={() => setEditing(null)}
        taskTitle={(block) => plan.task(block.taskId)?.title ?? null}
        onSave={save}
        onRemove={remove}
      />
      {!wide && (
        <>
          <Sheet
            open={openSheet === 'tasks'}
            onClose={closeSheet}
            title="To plan"
          >
            <ToPlan
              tasks={plan.toPlan}
              day={day}
              onAdd={(task) => addTask(task)}
            />
          </Sheet>
          <Sheet
            open={openSheet === 'calendars'}
            onClose={closeSheet}
            title="Calendars"
          >
            <CalendarsPanel {...calendarProps} />
          </Sheet>
        </>
      )}

      {drag && !drag.preview && (
        <div
          className="pointer-events-none fixed z-50 max-w-60 truncate rounded-full glass-strong px-3 py-1.5 text-sm font-semibold"
          style={{ left: drag.x + 14, top: drag.y + 10 }}
        >
          {drag.title}
        </div>
      )}
      {dropping && (
        <div className="pointer-events-none fixed inset-0 z-50 grid place-items-center bg-black/30">
          <p className="rounded-full glass-strong px-6 py-3 text-base font-semibold">
            Drop an .ics file to import it
          </p>
        </div>
      )}
      <p id="plan-block-keys" className="sr-only">
        Drag to move it, or use the up and down arrow keys. Drag its bottom
        edge, or hold Shift with the arrow keys, to change its length. Enter
        opens it; Delete takes it off the plan.
      </p>
      <p role="status" aria-live="polite" className="sr-only">
        {said}
      </p>
    </div>
  )
}
