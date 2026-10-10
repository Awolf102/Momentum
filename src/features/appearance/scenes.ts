import { PALETTES, type ScenePalette } from './lib/light'

/** The scene is drawn in a 1600 × 1000 space, anchored to the bottom edge. */
export const SCENE_WIDTH = 1600
export const SCENE_HEIGHT = 1000

/** A point in image space, 0–1 on each axis (0,0 = top left). */
export interface NormalizedPoint {
  x: number
  y: number
}

type Ridge = ReadonlyArray<readonly [number, number]>

/** Ridge silhouettes, back to front (scene coordinates). */
export const RIDGES = {
  far: [
    [0, 590],
    [70, 560],
    [140, 575],
    [230, 520],
    [290, 545],
    [360, 470],
    [420, 505],
    [470, 490],
    [540, 430],
    [600, 470],
    [650, 455],
    [720, 505],
    [800, 470],
    [860, 490],
    [930, 420],
    [990, 455],
    [1040, 440],
    [1110, 495],
    [1180, 470],
    [1250, 510],
    [1320, 460],
    [1390, 500],
    [1460, 480],
    [1530, 520],
    [1600, 500],
  ],
  mid: [
    [0, 660],
    [90, 620],
    [160, 640],
    [250, 580],
    [320, 615],
    [380, 600],
    [450, 650],
    [540, 590],
    [610, 625],
    [700, 560],
    [770, 600],
    [840, 585],
    [920, 640],
    [1010, 600],
    [1080, 625],
    [1170, 570],
    [1240, 605],
    [1320, 590],
    [1400, 640],
    [1480, 610],
    [1600, 650],
  ],
  near: [
    [0, 760],
    [110, 700],
    [200, 730],
    [290, 690],
    [380, 740],
    [480, 700],
    [560, 745],
    [660, 715],
    [760, 770],
    [860, 720],
    [950, 750],
    [1050, 705],
    [1150, 745],
    [1250, 715],
    [1350, 760],
    [1460, 725],
    [1600, 760],
  ],
} as const satisfies Record<string, Ridge>

export function ridgePath(ridge: Ridge): string {
  return `M${ridge.map(([x, y]) => `${x} ${y}`).join('L')}V${SCENE_HEIGHT}H0Z`
}

/**
 * The climb in the mountain scenes: along the far ridge to its highest peak.
 * Normalised so the climb feature can map it onto the screen.
 */
export const SCENE_TRAIL: NormalizedPoint[] = RIDGES.far
  .slice(
    RIDGES.far.findIndex(([x]) => x === 230),
    RIDGES.far.findIndex(([x]) => x === 930) + 1,
  )
  .map(([x, y]) => ({ x: x / SCENE_WIDTH, y: y / SCENE_HEIGHT }))

export type SceneId = 'alpine' | 'aurora' | 'moonrise' | 'first-light'
export type SceneExtra = 'aurora' | 'moon' | 'sun'

export interface SceneDefinition {
  /** A fixed palette, or `null` to follow the light setting. */
  palette: ScenePalette | null
  extra?: SceneExtra
  /** Centre of the sky glow, in scene coordinates. */
  glowAt: readonly [number, number]
}

export const SCENES: Record<SceneId, SceneDefinition> = {
  alpine: { palette: null, glowAt: [1040, 560] },
  aurora: {
    palette: {
      ...PALETTES.night,
      glow: '#5eead4',
      glowOpacity: 0.16,
      stars: 1,
    },
    extra: 'aurora',
    glowAt: [800, 520],
  },
  moonrise: {
    palette: {
      sky: ['#04060f', '#0a1230', '#16234d', '#25386a', '#3b5280'],
      glow: '#c7d7ff',
      glowOpacity: 0.4,
      stars: 0.8,
      far: ['#4a5a86', '#2c3a63'],
      mid: ['#2c3760', '#1b2444'],
      near: ['#182040', '#0f152d'],
      front: ['#0a0e1f', '#05070f'],
      mist: '#b8c8f0',
      mistOpacity: 0.12,
      snow: '#eef3ff',
      snowOpacity: 0.55,
    },
    extra: 'moon',
    glowAt: [1180, 330],
  },
  'first-light': {
    palette: { ...PALETTES.golden, glowOpacity: 0.75 },
    extra: 'sun',
    glowAt: [1040, 470],
  },
}
