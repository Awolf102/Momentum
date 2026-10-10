import {
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type Ref,
} from 'react'
import { CheckIcon, PlayIcon } from '@/components/icons'
import { cn } from '@/lib/cn'
import { useMediaQuery } from '@/lib/useMediaQuery'
import type { SessionOnDay, TaskMark } from '../hooks/usePlanDay'
import { CALENDAR_SWATCHES } from '../lib/colors'
import type { EventOnDay } from '../lib/day'
import { layoutDay } from '../lib/layout'
import {
  DAY_MINUTES,
  formatClock,
  formatHour,
  formatSpan,
  MIN_BLOCK,
  snap,
  STEP,
} from '../lib/time'
import type { Block } from '../types'

export interface TimelineHandle {
  /** The time under a point, snapped, or null when it isn't over the day. */
  minutesAt(clientX: number, clientY: number): number | null
  /**
   * Scrolls while a drag is near the top or bottom (null stops it), calling
   * `onScroll` as it goes so what's dragged keeps up.
   */
  edgeScroll(clientY: number | null, onScroll?: () => void): void
  scrollTo(minutes: number): void
}

/** A block being dragged in from elsewhere (a task from the list). */
export interface Preview {
  start: number
  end: number
  title: string
}

interface Gesture {
  id: string
  start: number
  end: number
}

type Item =
  | { type: 'block'; key: string; start: number; end: number; block: Block }
  | {
      type: 'event'
      key: string
      start: number
      end: number
      event: EventOnDay
    }

const LANE = 10 // room on the left for focus sessions done
const EDGE = 48 // how near the top or bottom a drag starts scrolling

interface TimelineProps {
  ref?: Ref<TimelineHandle>
  label: string
  blocks: readonly Block[]
  events: readonly EventOnDay[]
  sessions: readonly SessionOnDay[]
  marks: readonly TaskMark[]
  /** Minutes after midnight now, when the day is today. */
  now: number | null
  preview: Preview | null
  titleOf: (block: Block) => string
  colorOf: (block: Block) => string
  isDone: (block: Block) => boolean
  /** Whether a focus block can start the timer now. */
  canStart: (block: Block) => boolean
  onCreate: (start: number) => void
  onOpen: (block: Block) => void
  onChange: (block: Block, start: number, end: number) => void
  onRemove: (block: Block) => void
  onToggleTask: (block: Block) => void
  onStart: (block: Block) => void
}

/**
 * The day, hour by hour: imported events (read-only), blocks you move by
 * dragging (or with the arrow keys) and stretch from the bottom edge, focus
 * sessions done down the left, tasks due at a time, and the time now.
 */
export function Timeline({
  ref,
  label,
  blocks,
  events,
  sessions,
  marks,
  now,
  preview,
  titleOf,
  colorOf,
  isDone,
  canStart,
  onCreate,
  onOpen,
  onChange,
  onRemove,
  onToggleTask,
  onStart,
}: TimelineProps) {
  const wide = useMediaQuery('(min-width: 1024px)')
  const scale = wide ? 1.1 : 1 // pixels a minute
  const scroller = useRef<HTMLDivElement>(null)
  const grid = useRef<HTMLDivElement>(null)
  const [gesture, setGesture] = useState<Gesture | null>(null)
  const scrolling = useRef<{
    speed: number
    frame: number
    onScroll?: () => void
  }>({
    speed: 0,
    frame: 0,
  })

  function edgeScroll(clientY: number | null, onScroll?: () => void) {
    const box = scroller.current?.getBoundingClientRect()
    const state = scrolling.current
    state.onScroll = onScroll
    state.speed =
      clientY === null || !box
        ? 0
        : clientY < box.top + EDGE
          ? -Math.ceil((box.top + EDGE - clientY) / 4)
          : clientY > box.bottom - EDGE
            ? Math.ceil((clientY - (box.bottom - EDGE)) / 4)
            : 0
    if (state.speed === 0 || state.frame) return
    const step = () => {
      const element = scroller.current
      if (!element || state.speed === 0) {
        state.frame = 0
        return
      }
      element.scrollTop += state.speed
      state.onScroll?.()
      state.frame = requestAnimationFrame(step)
    }
    state.frame = requestAnimationFrame(step)
  }
  useEffect(() => {
    const state = scrolling.current
    return () => cancelAnimationFrame(state.frame)
  }, [])

  useImperativeHandle(ref, () => ({
    minutesAt(clientX, clientY) {
      const box = grid.current?.getBoundingClientRect()
      const view = scroller.current?.getBoundingClientRect()
      if (!box || !view) return null
      if (
        clientX < box.left ||
        clientX > box.right ||
        clientY < view.top ||
        clientY > view.bottom
      )
        return null
      return snap((clientY - box.top) / scale, STEP)
    },
    edgeScroll: (clientY, onScroll) => edgeScroll(clientY, onScroll),
    scrollTo(minutes) {
      scroller.current?.scrollTo({ top: Math.max(0, minutes * scale - 24) })
    },
  }))

  const items = useMemo(() => {
    const list: Item[] = [
      ...blocks.map((block) => {
        const moving = gesture?.id === block.id ? gesture : null
        return {
          type: 'block' as const,
          key: block.id,
          start: moving?.start ?? block.start,
          end: moving?.end ?? block.end,
          block,
        }
      }),
      ...events.map((event) => ({
        type: 'event' as const,
        key: event.key,
        start: event.start,
        end: event.end,
        event,
      })),
    ]
    return layoutDay(list, 22 / scale)
  }, [blocks, events, gesture, scale])

  /** Moving (from the body) or stretching (from the bottom edge) a block. */
  function grab(
    event: ReactPointerEvent<HTMLElement>,
    block: Block,
    mode: 'move' | 'resize',
  ) {
    if (event.button !== 0) return
    event.stopPropagation()
    const element = event.currentTarget
    const origin = {
      y: event.clientY,
      scroll: scroller.current?.scrollTop ?? 0,
    }
    let lastY = event.clientY
    // On a touch screen a block is held a moment before it moves, so the
    // day still scrolls under a finger.
    let active = event.pointerType !== 'touch' || mode === 'resize'
    let moved = false
    let opened = false
    let current: Gesture | null = null
    const hold = active
      ? 0
      : window.setTimeout(() => {
          active = true
          element.setPointerCapture(event.pointerId)
          navigator.vibrate?.(8)
        }, 280)
    if (active) element.setPointerCapture(event.pointerId)

    const place = () => {
      const scrolled = (scroller.current?.scrollTop ?? 0) - origin.scroll
      const delta =
        Math.round((lastY - origin.y + scrolled) / scale / STEP) * STEP
      if (!moved && Math.abs(lastY - origin.y + scrolled) < 4) return
      moved = true
      if (mode === 'move') {
        const length = block.end - block.start
        const start = Math.min(
          DAY_MINUTES - length,
          Math.max(0, block.start + delta),
        )
        current = { id: block.id, start, end: start + length }
      } else {
        const end = Math.min(
          DAY_MINUTES,
          Math.max(block.start + MIN_BLOCK, block.end + delta),
        )
        current = { id: block.id, start: block.start, end }
      }
      setGesture(current)
    }
    const stopScroll = (touch: TouchEvent) => {
      if (active) touch.preventDefault()
    }
    const onMove = (move: PointerEvent) => {
      if (move.pointerId !== event.pointerId) return
      if (!active) {
        // A finger that moves first is scrolling, not dragging.
        if (Math.abs(move.clientY - origin.y) > 8) finish(false)
        return
      }
      lastY = move.clientY
      place()
      edgeScroll(move.clientY, place)
    }
    const onUp = (up: PointerEvent) => {
      if (up.pointerId !== event.pointerId) return
      finish(up.type === 'pointerup')
    }
    function finish(commit: boolean) {
      clearTimeout(hold)
      edgeScroll(null)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
      element.removeEventListener('touchmove', stopScroll)
      if (element.hasPointerCapture(event.pointerId))
        element.releasePointerCapture(event.pointerId)
      const done = current
      setGesture(null)
      if (!commit) return
      if (moved && done) {
        if (done.start !== block.start || done.end !== block.end)
          onChange(block, done.start, done.end)
      } else {
        // A tap (or a hold) without a drag opens it, from its edge too.
        opened = true
        onOpen(block)
      }
    }
    // After a tap the browser sends a click where the finger was, which
    // would land on the sheet's backdrop, just opened, and close it again.
    // Cancelling the tap's touchend (it comes after pointerup) stops that.
    if (event.pointerType === 'touch')
      element.addEventListener(
        'touchend',
        (end) => {
          if (opened) end.preventDefault()
        },
        { once: true, passive: false },
      )
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
    element.addEventListener('touchmove', stopScroll, { passive: false })
  }

  function keys(event: KeyboardEvent<HTMLElement>, block: Block) {
    const length = block.end - block.start
    const step = (sign: number) => sign * STEP
    switch (event.key) {
      case 'ArrowUp':
      case 'ArrowDown': {
        event.preventDefault()
        const sign = event.key === 'ArrowUp' ? -1 : 1
        if (event.shiftKey) {
          const end = Math.min(
            DAY_MINUTES,
            Math.max(block.start + MIN_BLOCK, block.end + step(sign)),
          )
          if (end !== block.end) onChange(block, block.start, end)
        } else {
          const start = Math.min(
            DAY_MINUTES - length,
            Math.max(0, block.start + step(sign)),
          )
          if (start !== block.start) onChange(block, start, start + length)
        }
        break
      }
      case 'Delete':
      case 'Backspace':
        event.preventDefault()
        onRemove(block)
        break
      case 'Enter':
      case ' ':
        event.preventDefault()
        onOpen(block)
        break
    }
  }

  const height = DAY_MINUTES * scale
  const hours = Array.from({ length: 24 }, (_, hour) => hour)

  return (
    <div
      ref={scroller}
      className="relative h-[calc(100dvh-13rem)] min-h-[24rem] overflow-y-auto overscroll-contain rounded-[24px] glass lg:h-[calc(100dvh-12rem)]"
    >
      <div className="relative flex" style={{ height }}>
        <div
          className="relative w-14 shrink-0 select-none sm:w-16"
          aria-hidden="true"
        >
          {hours.slice(1).map((hour) => (
            <span
              key={hour}
              className="absolute right-2 -translate-y-1/2 text-[11px] text-fg-subtle tabular-nums"
              style={{ top: hour * 60 * scale }}
            >
              {formatHour(hour)}
            </span>
          ))}
        </div>
        <div
          ref={grid}
          role="region"
          aria-label={label}
          className="relative flex-1 border-l border-line"
        >
          {/* The hours, and a click on an empty time adds a block there. */}
          <div
            className="absolute inset-0 cursor-copy"
            onClick={(event) => {
              const box = event.currentTarget.getBoundingClientRect()
              const minutes =
                Math.floor((event.clientY - box.top) / scale / STEP) * STEP
              onCreate(Math.min(DAY_MINUTES - MIN_BLOCK, Math.max(0, minutes)))
            }}
            aria-hidden="true"
          >
            {hours.map((hour) => (
              <div
                key={hour}
                className="absolute inset-x-0 border-t border-line/70"
                style={{ top: hour * 60 * scale }}
              >
                <div
                  className="absolute inset-x-0 border-t border-dashed border-line/35"
                  style={{ top: 30 * scale }}
                />
              </div>
            ))}
          </div>

          {sessions.map((session) => (
            <div
              key={session.id}
              title={`Focused${session.subject ? ` on ${session.subject}` : ''}, ${formatSpan(session.start, session.end)}`}
              className="pointer-events-none absolute left-1 w-1.5 rounded-full opacity-80"
              style={{
                top: session.start * scale,
                height: Math.max(4, (session.end - session.start) * scale),
                background: session.color,
              }}
            />
          ))}

          {marks.map((mark) => (
            <div
              key={mark.id}
              className="pointer-events-none absolute inset-x-0 border-t border-dashed border-orange-300/60"
              style={{ top: mark.minutes * scale }}
            />
          ))}

          {items.map(({ item, column, columns }) => {
            const width = `calc((100% - ${LANE + 4}px) / ${columns} - 4px)`
            const left = `calc(${LANE}px + (100% - ${LANE + 4}px) * ${column} / ${columns})`
            const top = item.start * scale
            const tall = Math.max(22, (item.end - item.start) * scale)
            if (item.type === 'event') {
              const { event } = item
              const color = CALENDAR_SWATCHES[event.color]
              return (
                <div
                  key={item.key}
                  role="note"
                  aria-label={`${event.title}, ${formatSpan(event.start, event.end)}${event.location ? `, ${event.location}` : ''}`}
                  title={[event.title, event.location]
                    .filter(Boolean)
                    .join(' · ')}
                  onClick={(click) => click.stopPropagation()}
                  className="absolute overflow-hidden rounded-xl border-l-[3px] px-2 py-1 text-xs"
                  style={{
                    top,
                    height: tall,
                    left,
                    width,
                    borderColor: color,
                    // Outlined and light: events are read-only, blocks are yours.
                    background: `color-mix(in oklab, ${color} 9%, var(--glass-bg))`,
                    boxShadow: `inset 0 0 0 1px color-mix(in oklab, ${color} 45%, transparent)`,
                  }}
                >
                  <p className="truncate font-semibold">
                    {event.title || 'Busy'}
                  </p>
                  {tall >= 40 && (
                    <p className="truncate text-fg-muted">
                      {event.fromBefore ? '…' : formatClock(event.start)}
                      {event.location ? ` · ${event.location}` : ''}
                    </p>
                  )}
                </div>
              )
            }
            const { block } = item
            const color = colorOf(block)
            const title = titleOf(block)
            const done = isDone(block)
            const dragging = gesture?.id === block.id
            return (
              <div
                key={item.key}
                role="button"
                tabIndex={0}
                aria-label={`${title}, ${formatSpan(item.start, item.end)}`}
                aria-describedby="plan-block-keys"
                onPointerDown={(down) => grab(down, block, 'move')}
                onClick={(click) => click.stopPropagation()}
                onKeyDown={(key) => keys(key, block)}
                className={cn(
                  'group absolute touch-pan-y overflow-hidden rounded-xl border-l-[3px] px-2 py-1 text-xs shadow-[0_6px_18px_-12px_rgb(0_0_0/0.6)] outline-none select-none focus-visible:ring-2 focus-visible:ring-orange-300/70',
                  dragging
                    ? 'z-20 cursor-grabbing opacity-90'
                    : 'z-10 cursor-grab',
                  done && 'opacity-60',
                )}
                style={{
                  top,
                  height: tall,
                  left,
                  width,
                  borderColor: color,
                  background: `color-mix(in oklab, ${color} 28%, var(--glass-strong))`,
                }}
              >
                <div className="flex items-start gap-1.5">
                  {block.kind === 'task' && (
                    <button
                      type="button"
                      role="checkbox"
                      aria-checked={done}
                      aria-label={`Done: ${title}`}
                      onPointerDown={(down) => down.stopPropagation()}
                      onClick={(click) => {
                        click.stopPropagation()
                        onToggleTask(block)
                      }}
                      className={cn(
                        'mt-px grid size-3.5 shrink-0 place-items-center rounded-full border text-[9px]',
                        done
                          ? 'border-transparent bg-orange-400 text-orange-950'
                          : 'border-fg/60',
                      )}
                    >
                      {done && <CheckIcon />}
                    </button>
                  )}
                  <p
                    className={cn(
                      'min-w-0 flex-1 truncate font-semibold',
                      done && 'line-through',
                    )}
                  >
                    {title}
                  </p>
                  {block.kind === 'focus' && canStart(block) && (
                    <button
                      type="button"
                      aria-label={`Start focusing: ${title}`}
                      onPointerDown={(down) => down.stopPropagation()}
                      onClick={(click) => {
                        click.stopPropagation()
                        onStart(block)
                      }}
                      className="grid size-5 shrink-0 place-items-center rounded-full bg-fg/15 text-[10px] transition hover:bg-fg/25"
                    >
                      <PlayIcon />
                    </button>
                  )}
                </div>
                {tall >= 40 && (
                  <p className="truncate text-fg-muted tabular-nums">
                    {formatSpan(item.start, item.end)}
                  </p>
                )}
                <div
                  aria-hidden="true"
                  onPointerDown={(down) => grab(down, block, 'resize')}
                  // Never more than a third of a short block, so the rest still moves.
                  style={{
                    height: Math.min(wide ? 10 : 16, Math.max(6, tall / 3)),
                  }}
                  className="absolute inset-x-0 bottom-0 flex cursor-ns-resize touch-none justify-center opacity-0 transition group-hover:opacity-100 group-focus-visible:opacity-100 max-lg:opacity-60"
                >
                  <span className="mt-auto mb-0.5 h-1 w-6 rounded-full bg-fg/50" />
                </div>
              </div>
            )
          })}

          {marks.map((mark) => (
            <span
              key={`${mark.id}:label`}
              className="pointer-events-none absolute right-2 z-20 max-w-[75%] -translate-y-1/2 truncate rounded-full glass-strong px-2.5 py-0.5 text-[11px] font-semibold text-orange-200 light:text-orange-700"
              style={{ top: mark.minutes * scale }}
            >
              {mark.title} · due {formatClock(mark.minutes)}
            </span>
          ))}

          {preview && (
            <div
              className="pointer-events-none absolute z-30 rounded-xl border-2 border-dashed border-orange-300 bg-orange-400/15 px-2 py-1 text-xs font-semibold"
              style={{
                top: preview.start * scale,
                height: Math.max(22, (preview.end - preview.start) * scale),
                left: LANE,
                right: 4,
              }}
            >
              <p className="truncate">{preview.title}</p>
              <p className="font-normal text-fg-muted">
                {formatSpan(preview.start, preview.end)}
              </p>
            </div>
          )}

          {now !== null && (
            <div
              className="pointer-events-none absolute inset-x-0 z-30 border-t-2 border-rose-400"
              style={{ top: now * scale }}
              aria-hidden="true"
            >
              <span className="absolute -top-[5px] -left-[5px] size-2 rounded-full bg-rose-400" />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
