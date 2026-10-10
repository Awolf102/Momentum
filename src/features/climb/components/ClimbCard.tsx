import { GlassCard } from '@/components/GlassCard'
import { MountainIcon, SparkleIcon } from '@/components/icons'
import {
  appearanceStore,
  isUnlocked,
  listBackgrounds,
  SCENE_TRAIL,
  useCurrentBackground,
} from '@/features/appearance'
import { useProgress } from '@/lib/progress'
import { useStore } from '@/lib/store'
import { canClimb, useTrail } from '../hooks/useTrail'
import { climbFor } from '../lib/climb'
import { polylinePoints, profileOf, splitTrail } from '../lib/trail'
import { openClimb } from '../store'
import { Marker, SummitFlag } from './TrailMarks'

const WIDTH = 600
const HEIGHT = 120
const PAD_X = 24
const PAD_TOP = 34
const PAD_BOTTOM = 14

const days = (count: number) => `${count} ${count === 1 ? 'day' : 'days'}`

/** The climb at a glance: the ridge as an elevation profile, and where you are on it. */
export function ClimbCard() {
  const background = useCurrentBackground()
  const trail = useTrail(background)
  const { current, longest } = useProgress()
  const { photos } = useStore(appearanceStore)
  const climb = climbFor(current)

  const profile = profileOf(trail?.points ?? SCENE_TRAIL).map((point) => ({
    x: PAD_X + point.x * (WIDTH - PAD_X * 2),
    y: PAD_TOP + point.y * (HEIGHT - PAD_TOP - PAD_BOTTOM),
  }))
  const { walked, at } = splitTrail(profile, climb.progress, 1)
  const summit = profile[profile.length - 1]
  const area = `${polylinePoints(profile)} ${WIDTH - PAD_X},${HEIGHT} ${PAD_X},${HEIGHT}`

  const nextReward = listBackgrounds(photos).find(
    (item) => item.unlockAt && !isUnlocked(item, longest),
  )

  return (
    <GlassCard className="w-full overflow-hidden px-5 pt-5 pb-4 sm:px-6 sm:pt-6">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div>
          <p className="text-[11px] font-semibold tracking-[0.18em] text-fg-subtle uppercase">
            The climb · Peak {climb.number}
          </p>
          <h2 className="mt-1 text-[15px] font-semibold tracking-tight">
            {climb.atSummit
              ? `Summit reached at ${days(climb.summit)}`
              : `${days(climb.daysToSummit)} to the summit`}
          </h2>
        </div>
        {canClimb(background) && (
          <button
            type="button"
            onClick={openClimb}
            className="inline-flex items-center gap-2 rounded-full bg-tint px-3.5 py-2 text-xs font-medium text-fg-muted transition hover:bg-line hover:text-fg"
          >
            <MountainIcon className="text-sm" />
            View on the mountain
          </button>
        )}
      </div>

      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="mt-2 h-auto w-full overflow-visible"
        role="img"
        aria-label={`Climb progress: day ${climb.days} of ${climb.summit}, ${Math.round(climb.progress * 100)}% of the way to the summit.`}
      >
        <defs>
          <linearGradient id="climb-area" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="var(--fg)" stopOpacity="0.12" />
            <stop offset="1" stopColor="var(--fg)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <polygon points={area} fill="url(#climb-area)" />
        <polyline
          points={polylinePoints(profile)}
          fill="none"
          stroke="var(--fg)"
          strokeOpacity="0.3"
          strokeWidth="1.5"
          strokeDasharray="2 5"
          strokeLinecap="round"
        />
        <polyline
          points={polylinePoints(walked)}
          fill="none"
          stroke="#fb923c"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <SummitFlag
          x={summit.x}
          y={summit.y}
          reached={climb.atSummit}
          size={0.8}
        />
        <Marker x={at.x} y={at.y} size={0.75} />
      </svg>

      <div className="mt-1 flex items-center justify-between gap-4 text-[11px] text-fg-subtle tabular-nums">
        <span>Day {climb.base}</span>
        {nextReward ? (
          <span className="flex items-center gap-1.5 truncate">
            <SparkleIcon className="shrink-0 text-amber-300 light:text-orange-500" />
            <span className="truncate">
              {nextReward.name} unlocks at {nextReward.unlockAt} days
            </span>
          </span>
        ) : (
          <span>Climbing toward {climb.summit}</span>
        )}
        <span>Day {climb.summit}</span>
      </div>
    </GlassCard>
  )
}
