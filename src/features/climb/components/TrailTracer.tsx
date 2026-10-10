import { motion } from 'motion/react'
import { useEffect, useState, type PointerEvent } from 'react'
import { CheckIcon, UndoIcon } from '@/components/icons'
import {
  backgroundPanStore,
  type Background,
  type NormalizedPoint,
} from '@/features/appearance'
import { useStore } from '@/lib/store'
import { useViewport } from '@/lib/useViewport'
import type { Trail } from '../hooks/useTrail'
import { coverFit, fromScreen, polylinePoints, toScreen } from '../lib/trail'
import { openClimb, saveTrail } from '../store'

/**
 * Draw your own route: tap along the ridge from the trailhead to the summit.
 * Points are stored in image coordinates, so the trail fits any screen size.
 */
export function TrailTracer({
  background,
  reference,
}: {
  background: Background
  reference: Trail | null
}) {
  const viewport = useViewport()
  const [points, setPoints] = useState<NormalizedPoint[]>([])
  // Scenes are bottom-anchored; photos are centred. Unknown photos fall back to 16:9.
  const aspect = reference?.aspect ?? 16 / 9
  const align =
    reference?.align ?? (background.kind === 'scene' ? 'bottom' : 'center')
  // Match the background, which may be panned to show the route.
  const pan = useStore(backgroundPanStore)
  const fitted = coverFit(viewport.width, viewport.height, aspect, align)
  const cover = { ...fitted, offsetX: fitted.offsetX + pan }
  const screen = points.map((point) => toScreen(point, cover))

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault()
        openClimb()
      } else if ((event.metaKey || event.ctrlKey) && event.key === 'z') {
        event.preventDefault()
        setPoints((current) => current.slice(0, -1))
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  function addPoint(event: PointerEvent<SVGSVGElement>) {
    const point = fromScreen(event.clientX, event.clientY, cover)
    setPoints((current) => [...current, point])
  }

  function save() {
    saveTrail(background.id, points)
    openClimb()
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Trace the trail"
      className="fixed inset-0 z-40"
    >
      <svg
        width={viewport.width}
        height={viewport.height}
        onPointerDown={addPoint}
        className="absolute inset-0 cursor-crosshair touch-none"
      >
        {reference && (
          <polyline
            points={polylinePoints(
              reference.points.map((point) => toScreen(point, cover)),
            )}
            fill="none"
            stroke="white"
            strokeOpacity="0.35"
            strokeWidth="2"
            strokeDasharray="2 7"
            strokeLinecap="round"
          />
        )}
        <polyline
          points={polylinePoints(screen)}
          fill="none"
          stroke="#fdba74"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {screen.map((point, index) => (
          <circle
            key={index}
            cx={point.x}
            cy={point.y}
            r={index === 0 || index === screen.length - 1 ? 6 : 4}
            fill={index === screen.length - 1 ? '#fb923c' : '#fff'}
            stroke="#1c1917"
            strokeOpacity="0.4"
          />
        ))}
      </svg>
      {screen.length > 0 && (
        <span
          className="pointer-events-none absolute -translate-x-1/2 translate-y-3 rounded-full glass-strong px-2.5 py-1 text-[11px] font-semibold"
          style={{ left: screen[0].x, top: screen[0].y }}
        >
          Trailhead
        </span>
      )}

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        className="absolute inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] mx-auto max-w-md rounded-3xl glass-strong p-5"
      >
        <p className="text-[11px] font-semibold tracking-[0.18em] text-fg-subtle uppercase">
          Trace the trail
        </p>
        <p className="mt-1 text-sm">
          Tap along the ridge, starting at the trailhead and finishing on the
          summit.{' '}
          {points.length > 0 &&
            `${points.length} ${points.length === 1 ? 'point' : 'points'} so far.`}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={openClimb}
            className="rounded-full bg-tint px-4 py-2.5 text-sm font-medium transition hover:bg-line"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={points.length === 0}
            onClick={() => setPoints((current) => current.slice(0, -1))}
            className="inline-flex items-center gap-2 rounded-full bg-tint px-4 py-2.5 text-sm font-medium transition hover:bg-line disabled:opacity-40"
          >
            <UndoIcon /> Undo
          </button>
          <button
            type="button"
            disabled={points.length < 2}
            onClick={save}
            className="ml-auto inline-flex items-center gap-2 rounded-full bg-linear-to-br from-amber-300 to-orange-500 px-5 py-2.5 text-sm font-semibold text-orange-950 disabled:opacity-40"
          >
            <CheckIcon strokeWidth={2.5} /> Save trail
          </button>
        </div>
      </motion.div>
    </div>
  )
}
