import { motion } from 'motion/react'
import { memo, useId } from 'react'
import type { ScenePalette } from '../lib/light'
import { PAN_DURATION, PAN_EASING_POINTS } from '../pan'
import {
  RIDGES,
  ridgePath,
  SCENE_HEIGHT,
  SCENE_WIDTH,
  type SceneExtra,
} from '../scenes'

/** Deterministic pseudo-random numbers so the stars never move between renders. */
function seeded(seed: number) {
  let state = seed
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296
    return state / 4294967296
  }
}

const random = seeded(7)
const STARS = Array.from({ length: 90 }, () => ({
  x: random() * SCENE_WIDTH,
  y: random() * 470,
  r: 0.5 + random() * 1.3,
  opacity: 0.25 + random() * 0.6,
}))

const AURORA_RIBBONS = [
  {
    d: 'M-60 300C180 210 380 330 620 250S1060 150 1300 230 1600 200 1680 160V40H-60Z',
    delay: 0,
  },
  {
    d: 'M-60 230C220 140 460 250 720 180S1120 110 1380 170 1640 130 1680 100V0H-60Z',
    delay: 1,
  },
  {
    d: 'M300 340C520 260 700 360 940 290S1340 230 1680 300V160H300Z',
    delay: 2,
  },
]

interface MountainSceneProps {
  palette: ScenePalette
  extra?: SceneExtra
  glowAt: readonly [number, number]
  /** Shifts the view horizontally, in scene units (for panning). */
  shiftX?: number
  className?: string
}

/**
 * Momentum's mountain range: layered ridges, sky, stars and mist, painted from
 * a palette so the same scene can be dawn, daylight, golden hour or night.
 */
export const MountainScene = memo(function MountainScene({
  palette,
  extra,
  glowAt,
  shiftX = 0,
  className,
}: MountainSceneProps) {
  // Unique gradient ids, since a scene can be on screen twice (background + picker).
  const prefix = useId().replace(/[^\w-]/g, '')
  const id = (name: string) => `${prefix}-${name}`
  const url = (name: string) => `url(#${id(name)})`
  const skyStops = [0, 0.42, 0.7, 0.86, 1]

  return (
    <motion.svg
      className={className}
      initial={false}
      animate={{ viewBox: `${shiftX} 0 ${SCENE_WIDTH} ${SCENE_HEIGHT}` }}
      transition={{ duration: PAN_DURATION / 1000, ease: PAN_EASING_POINTS }}
      preserveAspectRatio="xMidYMax slice"
      aria-hidden="true"
      data-scene=""
    >
      <defs>
        <linearGradient
          id={id('sky')}
          x1="0"
          y1="0"
          x2="0"
          y2="720"
          gradientUnits="userSpaceOnUse"
        >
          {palette.sky.map((color, index) => (
            <stop key={index} offset={skyStops[index]} stopColor={color} />
          ))}
        </linearGradient>
        <radialGradient
          id={id('glow')}
          cx={glowAt[0]}
          cy={glowAt[1]}
          r="560"
          gradientUnits="userSpaceOnUse"
        >
          <stop
            offset="0"
            stopColor={palette.glow}
            stopOpacity={palette.glowOpacity}
          />
          <stop
            offset="0.45"
            stopColor={palette.glow}
            stopOpacity={palette.glowOpacity * 0.3}
          />
          <stop offset="1" stopColor={palette.glow} stopOpacity="0" />
        </radialGradient>
        {(['far', 'mid', 'near', 'front'] as const).map((layer) => (
          <linearGradient
            key={layer}
            id={id(layer)}
            x1="0"
            y1={{ far: 420, mid: 560, near: 690, front: 800 }[layer]}
            x2="0"
            y2={{ far: 700, mid: 800, near: 900, front: 1000 }[layer]}
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0" stopColor={palette[layer][0]} />
            <stop offset="1" stopColor={palette[layer][1]} />
          </linearGradient>
        ))}
        <linearGradient id={id('mist')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={palette.mist} stopOpacity="0" />
          <stop
            offset="0.5"
            stopColor={palette.mist}
            stopOpacity={palette.mistOpacity}
          />
          <stop offset="1" stopColor={palette.mist} stopOpacity="0" />
        </linearGradient>
        {extra === 'aurora' && (
          <>
            <linearGradient
              id={id('aurora')}
              x1="0"
              y1="0"
              x2="0"
              y2="360"
              gradientUnits="userSpaceOnUse"
            >
              <stop offset="0" stopColor="#a78bfa" stopOpacity="0" />
              <stop offset="0.55" stopColor="#5eead4" stopOpacity="0.28" />
              <stop offset="0.85" stopColor="#34d399" stopOpacity="0.5" />
              <stop offset="1" stopColor="#34d399" stopOpacity="0" />
            </linearGradient>
            <filter
              id={id('soft')}
              x="-10%"
              y="-20%"
              width="120%"
              height="140%"
            >
              <feGaussianBlur stdDeviation="14" />
            </filter>
          </>
        )}
        {extra === 'moon' && (
          <radialGradient id={id('moon')} cx="0.4" cy="0.35" r="0.75">
            <stop offset="0" stopColor="#ffffff" />
            <stop offset="1" stopColor="#d9e2f5" />
          </radialGradient>
        )}
      </defs>

      <rect width={SCENE_WIDTH} height={SCENE_HEIGHT} fill={url('sky')} />
      <g fill="#fff" opacity={palette.stars}>
        {STARS.map((star, index) => (
          <circle
            key={index}
            cx={star.x}
            cy={star.y}
            r={star.r}
            opacity={star.opacity}
          />
        ))}
      </g>
      {extra === 'aurora' && (
        <g filter={url('soft')}>
          {AURORA_RIBBONS.map((ribbon) => (
            <path key={ribbon.delay} d={ribbon.d} fill={url('aurora')} />
          ))}
        </g>
      )}
      <rect width={SCENE_WIDTH} height={SCENE_HEIGHT} fill={url('glow')} />
      {extra === 'moon' && (
        <g>
          <circle cx={glowAt[0]} cy={glowAt[1]} r="64" fill={url('moon')} />
          <g fill="#aab6d3" opacity="0.35">
            <circle cx={glowAt[0] - 18} cy={glowAt[1] - 10} r="11" />
            <circle cx={glowAt[0] + 20} cy={glowAt[1] + 16} r="8" />
            <circle cx={glowAt[0] + 6} cy={glowAt[1] - 30} r="5" />
          </g>
        </g>
      )}
      {extra === 'sun' && (
        <circle
          cx={glowAt[0]}
          cy={glowAt[1]}
          r="58"
          fill="#fff4cf"
          opacity="0.95"
        />
      )}

      <path fill={url('far')} d={ridgePath(RIDGES.far)} />
      {/* Snow catching the light on the highest peaks. */}
      <path
        fill={palette.snow}
        opacity={palette.snowOpacity}
        d="M540 430L565 446L552 450L540 444L528 452L518 445ZM930 420L955 437L942 441L931 434L918 442L909 435ZM360 470L380 484L370 487L360 482L349 488L342 483Z"
      />
      <rect y="520" width={SCENE_WIDTH} height="140" fill={url('mist')} />
      <path fill={url('mid')} d={ridgePath(RIDGES.mid)} />
      <rect
        y="640"
        width={SCENE_WIDTH}
        height="120"
        fill={url('mist')}
        opacity="0.7"
      />
      <path fill={url('near')} d={ridgePath(RIDGES.near)} />
      <path
        fill={url('front')}
        d="M0 860C200 820 380 880 560 850S900 800 1100 850S1400 880 1600 830V1000H0Z"
      />
    </motion.svg>
  )
})
