import { AnimatePresence, motion } from 'motion/react'
import { useEffect } from 'react'
import { ArrowLeftIcon, MountainIcon, PencilIcon } from '@/components/icons'
import {
  backgroundPanStore,
  PAN_TRANSITION,
  setBackgroundPan,
  useCurrentBackground,
} from '@/features/appearance'
import { cn } from '@/lib/cn'
import { useProgress } from '@/lib/progress'
import { useStore } from '@/lib/store'
import { useViewport } from '@/lib/useViewport'
import { canClimb, useTrail, type Trail } from '../hooks/useTrail'
import { climbFor, type Climb } from '../lib/climb'
import {
  coverFit,
  panToShow,
  polylinePoints,
  splitTrail,
  toScreen,
} from '../lib/trail'
import { clearTrail, climbViewStore, closeClimb, startTracing } from '../store'
import { Marker, SummitFlag } from './TrailMarks'
import { TrailTracer } from './TrailTracer'

/**
 * The climber on the mountain. On the dashboard it sits quietly behind the
 * cards; in the climb view the cards step aside and the whole route shows.
 */
export function ClimbOverlay() {
  const view = useStore(climbViewStore)
  const background = useCurrentBackground()
  const trail = useTrail(background)
  const { current } = useProgress()
  const climb = climbFor(current)
  const viewport = useViewport()

  useEffect(() => {
    if (view === 'off') return
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape' || view !== 'view') return
      event.preventDefault()
      closeClimb()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [view])

  // On narrow screens the route can be cropped; pan the mountain to show it.
  const focus = trail
    ? splitTrail(trail.points, climb.progress, trail.aspect).at
    : null
  const pan =
    view !== 'off' && trail && focus && viewport.width > 0
      ? panToShow(
          trail.points,
          focus,
          coverFit(viewport.width, viewport.height, trail.aspect, trail.align),
          viewport.width,
        )
      : 0
  useEffect(() => {
    setBackgroundPan(pan)
  }, [pan])
  useEffect(() => () => setBackgroundPan(0), [])

  if (view === 'trace') {
    return <TrailTracer background={background} reference={trail} />
  }

  return (
    <>
      {trail && viewport.width > 0 && (
        <TrailDrawing
          trail={trail}
          climb={climb}
          viewport={viewport}
          prominent={view === 'view'}
        />
      )}
      <AnimatePresence>
        {view === 'view' && (
          <ClimbPanel
            climb={climb}
            trail={trail}
            canTrace={canClimb(background)}
            backgroundId={background.id}
          />
        )}
      </AnimatePresence>
    </>
  )
}

function TrailDrawing({
  trail,
  climb,
  viewport,
  prominent,
}: {
  trail: Trail
  climb: Climb
  viewport: { width: number; height: number }
  prominent: boolean
}) {
  const cover = coverFit(
    viewport.width,
    viewport.height,
    trail.aspect,
    trail.align,
  )
  const { walked, ahead, at } = splitTrail(
    trail.points,
    climb.progress,
    trail.aspect,
  )
  const screen = (points: typeof walked) =>
    points.map((point) => toScreen(point, cover))
  const marker = toScreen(at, cover)
  const pan = useStore(backgroundPanStore)
  const summit = toScreen(trail.points[trail.points.length - 1], cover)

  return (
    <div
      aria-hidden="true"
      className={cn(
        'pointer-events-none fixed inset-0',
        prominent ? 'z-30' : '-z-[5]',
      )}
    >
      <div
        className="absolute inset-0"
        style={{
          transform: `translateX(${pan}px)`,
          transition: PAN_TRANSITION,
        }}
      >
        <svg
          width={viewport.width}
          height={viewport.height}
          className="absolute inset-0 overflow-visible"
        >
          <defs>
            <filter
              id="climb-glow"
              x="-20%"
              y="-20%"
              width="140%"
              height="140%"
            >
              <feGaussianBlur stdDeviation="3" />
            </filter>
          </defs>
          <motion.g
            initial={false}
            animate={{ opacity: prominent ? 1 : 0 }}
            transition={{ duration: 0.6 }}
          >
            <polyline
              points={polylinePoints(screen(ahead))}
              fill="none"
              stroke="white"
              strokeOpacity="0.7"
              strokeWidth="2"
              strokeDasharray="2 7"
              strokeLinecap="round"
            />
            <polyline
              points={polylinePoints(screen(walked))}
              fill="none"
              stroke="#fb923c"
              strokeWidth="6"
              strokeLinecap="round"
              strokeLinejoin="round"
              filter="url(#climb-glow)"
              opacity="0.7"
            />
          </motion.g>
          <polyline
            points={polylinePoints(screen(walked))}
            fill="none"
            stroke="#fdba74"
            strokeOpacity={prominent ? 1 : 0.55}
            strokeWidth={prominent ? 2.5 : 1.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <SummitFlag
            x={summit.x}
            y={summit.y}
            reached={climb.atSummit}
            size={prominent ? 1.15 : 0.8}
          />
          <Marker x={marker.x} y={marker.y} size={prominent ? 1.2 : 0.8} />
        </svg>
        <AnimatePresence>
          {prominent && (
            <motion.span
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="absolute -translate-x-1/2 -translate-y-full rounded-full glass-strong px-3 py-1 text-xs font-semibold whitespace-nowrap text-fg"
              style={{ left: marker.x, top: marker.y - 22 }}
            >
              {climb.atSummit ? 'On the summit' : `Day ${climb.days}`}
            </motion.span>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

function ClimbPanel({
  climb,
  trail,
  canTrace,
  backgroundId,
}: {
  climb: Climb
  trail: Trail | null
  canTrace: boolean
  backgroundId: string
}) {
  const days = (count: number) => `${count} ${count === 1 ? 'day' : 'days'}`
  return (
    <motion.div
      role="dialog"
      aria-modal="true"
      aria-label="The climb"
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 16 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      className="fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-40 mx-auto max-w-md rounded-3xl glass-strong p-5 sm:p-6"
    >
      <p className="text-[11px] font-semibold tracking-[0.18em] text-fg-subtle uppercase">
        The climb · Peak {climb.number}
      </p>
      <h2 className="mt-1 font-serif text-3xl leading-tight">
        {climb.atSummit
          ? `Summit reached: ${days(climb.summit)}`
          : `${days(climb.daysToSummit)} to the summit`}
      </h2>
      <div className="mt-4 flex items-center gap-3 text-xs text-fg-subtle tabular-nums">
        <span>{climb.base}</span>
        <span className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-tint">
          <span
            className="absolute inset-y-0 left-0 rounded-full bg-linear-to-r from-amber-300 to-orange-500"
            style={{ width: `${climb.progress * 100}%` }}
          />
        </span>
        <span>{climb.summit}</span>
      </div>
      {!trail && (
        <p className="mt-3 text-sm text-fg-muted">
          {canTrace
            ? "No ridge found automatically in this photo. Trace the trail and you'll see yourself climb it."
            : 'Choose a mountain scene or photo to see your climb.'}
        </p>
      )}
      {trail?.source === 'automatic' && (
        <p className="mt-3 text-xs text-fg-subtle">
          Trail found automatically along the skyline. Trace it yourself for a
          perfect fit.
        </p>
      )}
      <div className="mt-5 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={closeClimb}
          className="inline-flex items-center gap-2 rounded-full bg-tint px-4 py-2.5 text-sm font-medium transition hover:bg-line"
        >
          <ArrowLeftIcon /> Dashboard
        </button>
        {canTrace && (
          <button
            type="button"
            onClick={startTracing}
            className="inline-flex items-center gap-2 rounded-full bg-tint px-4 py-2.5 text-sm font-medium transition hover:bg-line"
          >
            <PencilIcon /> Trace the trail
          </button>
        )}
        {trail?.source === 'traced' && (
          <button
            type="button"
            onClick={() => clearTrail(backgroundId)}
            className="inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-medium text-fg-muted transition hover:bg-tint"
          >
            <MountainIcon /> Use the default trail
          </button>
        )}
      </div>
    </motion.div>
  )
}
