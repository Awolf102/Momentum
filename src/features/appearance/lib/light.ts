import { lerp, mixHex } from '@/lib/color'

/**
 * Light: the mood of the background. The mountain scene repaints its sky and
 * ridges; photos get a gentle colour grade. Light can follow the clock, warm up
 * as a streak grows, or stay off.
 */
export type LightMode = 'time' | 'streak' | 'off'

export type Phase = 'night' | 'dawn' | 'day' | 'golden' | 'dusk'

export const PHASE_LABELS: Record<Phase, string> = {
  night: 'Night',
  dawn: 'Dawn',
  day: 'Daylight',
  golden: 'Golden hour',
  dusk: 'Dusk',
}

/** Colours for the SVG mountain scene. Ridge pairs are [top, bottom]. */
export interface ScenePalette {
  sky: [string, string, string, string, string]
  glow: string
  glowOpacity: number
  stars: number
  far: [string, string]
  mid: [string, string]
  near: [string, string]
  front: [string, string]
  mist: string
  mistOpacity: number
  snow: string
  snowOpacity: number
}

/** A soft-light tint (top → bottom) plus a brightness/saturation adjustment for photos. */
export interface PhotoGrade {
  top: string
  bottom: string
  opacity: number
  brightness: number
  saturate: number
}

export interface Light {
  palette: ScenePalette
  grade: PhotoGrade
  /** The phase this light is closest to, for labels. */
  phase: Phase
}

export const PALETTES: Record<Phase, ScenePalette> = {
  night: {
    sky: ['#03050d', '#070c1f', '#0f1530', '#1a1f3d', '#262a4a'],
    glow: '#5b6bb0',
    glowOpacity: 0.2,
    stars: 1,
    far: ['#2a2f52', '#1a1d38'],
    mid: ['#1c1f3d', '#121429'],
    near: ['#11122a', '#0a0b1c'],
    front: ['#08081a', '#04040b'],
    mist: '#8aa0d6',
    mistOpacity: 0.08,
    snow: '#c9d4f0',
    snowOpacity: 0.2,
  },
  dawn: {
    sky: ['#1b2140', '#3b3d6b', '#7d6390', '#d98a8f', '#f6c39b'],
    glow: '#ffd1a8',
    glowOpacity: 0.55,
    stars: 0.15,
    far: ['#7a6a98', '#4d4472'],
    mid: ['#4d4270', '#332c55'],
    near: ['#2c2648', '#1d1934'],
    front: ['#16132a', '#0c0a18'],
    mist: '#f3c6d6',
    mistOpacity: 0.18,
    snow: '#ffe3e0',
    snowOpacity: 0.4,
  },
  day: {
    sky: ['#2f6fb5', '#4b8fd0', '#7db2e0', '#acd0ec', '#d6e8f5'],
    glow: '#ffffff',
    glowOpacity: 0.25,
    stars: 0,
    far: ['#7d97b8', '#5f7a9e'],
    mid: ['#536d91', '#3e5677'],
    near: ['#34486a', '#253650'],
    front: ['#1d2a40', '#121b2b'],
    mist: '#ffffff',
    mistOpacity: 0.2,
    snow: '#ffffff',
    snowOpacity: 0.65,
  },
  golden: {
    sky: ['#3a4a7a', '#6f6a8f', '#d4936b', '#f2b36b', '#ffd58a'],
    glow: '#ffc46b',
    glowOpacity: 0.6,
    stars: 0,
    far: ['#9a7a8a', '#6d5670'],
    mid: ['#5e4a66', '#433550'],
    near: ['#3a2c45', '#271e31'],
    front: ['#1d1524', '#100b15'],
    mist: '#ffd9a8',
    mistOpacity: 0.2,
    snow: '#ffe2b0',
    snowOpacity: 0.55,
  },
  dusk: {
    sky: ['#050816', '#101838', '#2a2350', '#5b3459', '#b0604f'],
    glow: '#ffb17a',
    glowOpacity: 0.45,
    stars: 0.6,
    far: ['#56427a', '#2b2452'],
    mid: ['#30285a', '#1a1739'],
    near: ['#1b1838', '#0f0d22'],
    front: ['#0c0b1d', '#06050d'],
    mist: '#c9a6d6',
    mistOpacity: 0.14,
    snow: '#e9d3e6',
    snowOpacity: 0.22,
  },
}

export const GRADES: Record<Phase, PhotoGrade> = {
  night: {
    top: '#1e2a5a',
    bottom: '#0a1030',
    opacity: 0.55,
    brightness: 0.72,
    saturate: 0.85,
  },
  dawn: {
    top: '#f4a6c0',
    bottom: '#ffc48a',
    opacity: 0.35,
    brightness: 0.97,
    saturate: 1.05,
  },
  day: {
    top: '#ffffff',
    bottom: '#ffffff',
    opacity: 0,
    brightness: 1,
    saturate: 1,
  },
  golden: {
    top: '#ffb347',
    bottom: '#ff8a3d',
    opacity: 0.38,
    brightness: 1,
    saturate: 1.12,
  },
  dusk: {
    top: '#6b46c1',
    bottom: '#f97362',
    opacity: 0.4,
    brightness: 0.86,
    saturate: 1,
  },
}

function mixPair(
  a: [string, string],
  b: [string, string],
  t: number,
): [string, string] {
  return [mixHex(a[0], b[0], t), mixHex(a[1], b[1], t)]
}

export function mixPalettes(
  a: ScenePalette,
  b: ScenePalette,
  t: number,
): ScenePalette {
  return {
    sky: a.sky.map((color, index) =>
      mixHex(color, b.sky[index], t),
    ) as ScenePalette['sky'],
    glow: mixHex(a.glow, b.glow, t),
    glowOpacity: lerp(a.glowOpacity, b.glowOpacity, t),
    stars: lerp(a.stars, b.stars, t),
    far: mixPair(a.far, b.far, t),
    mid: mixPair(a.mid, b.mid, t),
    near: mixPair(a.near, b.near, t),
    front: mixPair(a.front, b.front, t),
    mist: mixHex(a.mist, b.mist, t),
    mistOpacity: lerp(a.mistOpacity, b.mistOpacity, t),
    snow: mixHex(a.snow, b.snow, t),
    snowOpacity: lerp(a.snowOpacity, b.snowOpacity, t),
  }
}

export function mixGrades(a: PhotoGrade, b: PhotoGrade, t: number): PhotoGrade {
  return {
    top: mixHex(a.top, b.top, t),
    bottom: mixHex(a.bottom, b.bottom, t),
    opacity: lerp(a.opacity, b.opacity, t),
    brightness: lerp(a.brightness, b.brightness, t),
    saturate: lerp(a.saturate, b.saturate, t),
  }
}

type Keyframe = readonly [position: number, phase: Phase]

/** Blends between keyframes; positions must be ascending. */
function lightAlong(keyframes: readonly Keyframe[], position: number): Light {
  const first = keyframes[0]
  const last = keyframes[keyframes.length - 1]
  if (position <= first[0]) return pure(first[1])
  if (position >= last[0]) return pure(last[1])
  const index = keyframes.findIndex(([at]) => at > position)
  const [fromAt, from] = keyframes[index - 1]
  const [toAt, to] = keyframes[index]
  const t = (position - fromAt) / (toAt - fromAt)
  return {
    palette: mixPalettes(PALETTES[from], PALETTES[to], t),
    grade: mixGrades(GRADES[from], GRADES[to], t),
    phase: t < 0.5 ? from : to,
  }
}

function pure(phase: Phase): Light {
  return { palette: PALETTES[phase], grade: GRADES[phase], phase }
}

/** Hours of the day (0–24) at which each phase is at its fullest. */
const DAY_CYCLE: readonly Keyframe[] = [
  [0, 'night'],
  [4.5, 'night'],
  [6.25, 'dawn'],
  [8.5, 'day'],
  [16, 'day'],
  [18, 'golden'],
  [19.5, 'dusk'],
  [21, 'night'],
  [24, 'night'],
]

/** Light that follows the local clock: night → dawn → day → golden hour → dusk. */
export function lightForTime(date: Date): Light {
  const hours = date.getHours() + date.getMinutes() / 60
  return lightAlong(DAY_CYCLE, hours)
}

/** Streak length (0–1, eased) → cold night, then dawn, then golden hour. */
const WARMTH: readonly Keyframe[] = [
  [0, 'night'],
  [0.35, 'dawn'],
  [1, 'golden'],
]

/** Days at which the warmth reaches full golden hour. */
export const FULL_WARMTH_DAYS = 60

/** Light that warms as the streak lengthens; the first days change the most. */
export function lightForStreak(streak: number): Light {
  const t = Math.sqrt(Math.min(1, Math.max(0, streak) / FULL_WARMTH_DAYS))
  return lightAlong(WARMTH, t)
}

/** Light switched off: the scene's signature dusk and untouched photos. */
export const LIGHT_OFF: Light = {
  palette: PALETTES.dusk,
  grade: GRADES.day,
  phase: 'dusk',
}

export function getLight(mode: LightMode, now: Date, streak: number): Light {
  if (mode === 'time') return lightForTime(now)
  if (mode === 'streak') return lightForStreak(streak)
  return LIGHT_OFF
}
