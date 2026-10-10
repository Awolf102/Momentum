import { memo, useId } from 'react'

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
  x: random() * 1600,
  y: random() * 470,
  r: 0.5 + random() * 1.3,
  opacity: 0.25 + random() * 0.6,
}))

/**
 * Momentum's default background: layered mountain ridges at dusk. Drawn as SVG
 * so it is crisp at any size and weighs almost nothing.
 */
export const AlpineDusk = memo(function AlpineDusk({
  className,
}: {
  className?: string
}) {
  // Unique gradient ids, since the scene can be on screen twice (background + picker).
  const prefix = useId().replace(/[^\w-]/g, '')
  const id = (name: string) => `${prefix}-${name}`
  const url = (name: string) => `url(#${id(name)})`
  return (
    <svg
      className={className}
      viewBox="0 0 1600 1000"
      preserveAspectRatio="xMidYMax slice"
      aria-hidden="true"
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
          <stop offset="0" stopColor="#050816" />
          <stop offset="0.42" stopColor="#101838" />
          <stop offset="0.7" stopColor="#2a2350" />
          <stop offset="0.86" stopColor="#5b3459" />
          <stop offset="1" stopColor="#b0604f" />
        </linearGradient>
        <radialGradient
          id={id('glow')}
          cx="1040"
          cy="560"
          r="560"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0" stopColor="#ffb17a" stopOpacity="0.45" />
          <stop offset="0.45" stopColor="#f0786a" stopOpacity="0.14" />
          <stop offset="1" stopColor="#f0786a" stopOpacity="0" />
        </radialGradient>
        <linearGradient
          id={id('far')}
          x1="0"
          y1="420"
          x2="0"
          y2="700"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0" stopColor="#56427a" />
          <stop offset="1" stopColor="#2b2452" />
        </linearGradient>
        <linearGradient
          id={id('mid')}
          x1="0"
          y1="560"
          x2="0"
          y2="800"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0" stopColor="#30285a" />
          <stop offset="1" stopColor="#1a1739" />
        </linearGradient>
        <linearGradient
          id={id('near')}
          x1="0"
          y1="690"
          x2="0"
          y2="900"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0" stopColor="#1b1838" />
          <stop offset="1" stopColor="#0f0d22" />
        </linearGradient>
        <linearGradient
          id={id('front')}
          x1="0"
          y1="800"
          x2="0"
          y2="1000"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0" stopColor="#0c0b1d" />
          <stop offset="1" stopColor="#06050d" />
        </linearGradient>
        <linearGradient id={id('mist')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#c9a6d6" stopOpacity="0" />
          <stop offset="0.5" stopColor="#c9a6d6" stopOpacity="0.14" />
          <stop offset="1" stopColor="#c9a6d6" stopOpacity="0" />
        </linearGradient>
      </defs>

      <rect width="1600" height="1000" fill={url('sky')} />
      <g fill="#fff">
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
      <rect width="1600" height="1000" fill={url('glow')} />

      <path
        fill={url('far')}
        d="M0 590L70 560L140 575L230 520L290 545L360 470L420 505L470 490L540 430L600 470L650 455L720 505L800 470L860 490L930 420L990 455L1040 440L1110 495L1180 470L1250 510L1320 460L1390 500L1460 480L1530 520L1600 500V1000H0Z"
      />
      {/* Snow catching the last light on the highest peaks. */}
      <path
        fill="#e9d3e6"
        opacity="0.22"
        d="M540 430L565 446L552 450L540 444L528 452L518 445ZM930 420L955 437L942 441L931 434L918 442L909 435ZM360 470L380 484L370 487L360 482L349 488L342 483Z"
      />
      <rect y="520" width="1600" height="140" fill={url('mist')} />
      <path
        fill={url('mid')}
        d="M0 660L90 620L160 640L250 580L320 615L380 600L450 650L540 590L610 625L700 560L770 600L840 585L920 640L1010 600L1080 625L1170 570L1240 605L1320 590L1400 640L1480 610L1600 650V1000H0Z"
      />
      <rect
        y="640"
        width="1600"
        height="120"
        fill={url('mist')}
        opacity="0.7"
      />
      <path
        fill={url('near')}
        d="M0 760L110 700L200 730L290 690L380 740L480 700L560 745L660 715L760 770L860 720L950 750L1050 705L1150 745L1250 715L1350 760L1460 725L1600 760V1000H0Z"
      />
      <path
        fill={url('front')}
        d="M0 860C200 820 380 880 560 850S900 800 1100 850S1400 880 1600 830V1000H0Z"
      />
    </svg>
  )
})
