import { describe, expect, it } from 'vitest'
import { climbFor, summitAfter } from './climb'
import { detectSkyline, trailFromSkyline } from './skyline'
import {
  coverFit,
  fromScreen,
  panToShow,
  profileOf,
  splitTrail,
  toScreen,
} from './trail'

describe('climbFor', () => {
  it('starts at the trailhead', () => {
    expect(climbFor(0)).toMatchObject({
      number: 1,
      base: 0,
      summit: 7,
      progress: 0,
    })
  })

  it('climbs toward the next summit', () => {
    expect(climbFor(5)).toMatchObject({
      summit: 7,
      daysToSummit: 2,
      atSummit: false,
    })
    expect(climbFor(5).progress).toBeCloseTo(5 / 7)
  })

  it('stands on the summit on milestone days', () => {
    expect(climbFor(30)).toMatchObject({
      number: 3,
      base: 14,
      summit: 30,
      progress: 1,
      atSummit: true,
    })
  })

  it('begins a new climb the day after a summit', () => {
    expect(climbFor(31)).toMatchObject({ number: 4, base: 30, summit: 60 })
    expect(climbFor(31).progress).toBeCloseTo(1 / 30)
  })

  it('keeps going after a year', () => {
    expect(summitAfter(365)).toBe(465)
    expect(climbFor(400)).toMatchObject({ base: 365, summit: 465, number: 8 })
    expect(climbFor(465)).toMatchObject({ atSummit: true, number: 8 })
  })
})

describe('trail geometry', () => {
  const trail = [
    { x: 0, y: 1 },
    { x: 0.5, y: 0.5 },
    { x: 1, y: 0 },
  ]

  it('splits a trail at a fraction of its length', () => {
    const { at, walked, ahead } = splitTrail(trail, 0.25, 1)
    expect(at.x).toBeCloseTo(0.25)
    expect(at.y).toBeCloseTo(0.75)
    expect(walked).toHaveLength(2)
    expect(ahead).toHaveLength(3)
    expect(splitTrail(trail, 1, 1).at).toEqual({ x: 1, y: 0 })
  })

  it('maps between image and screen like object-fit: cover', () => {
    // A 2:1 image in a 1000 × 1000 viewport is 2000 wide, centred.
    const cover = coverFit(1000, 1000, 2, 'center')
    expect(cover).toEqual({
      width: 2000,
      height: 1000,
      offsetX: -500,
      offsetY: 0,
    })
    expect(toScreen({ x: 0.5, y: 0.5 }, cover)).toEqual({ x: 500, y: 500 })
    expect(fromScreen(500, 500, cover)).toEqual({ x: 0.5, y: 0.5 })
    // Bottom-aligned (the SVG scene): a tall viewport crops the top.
    expect(coverFit(1600, 400, 1.6, 'bottom').offsetY).toBe(-600)
  })

  it('draws profiles left to right from trailhead to summit', () => {
    const reversed = [
      { x: 0.9, y: 0.8 },
      { x: 0.5, y: 0.2 },
    ]
    expect(profileOf(reversed)).toEqual([
      { x: 0, y: 1 },
      { x: 1, y: 0 },
    ])
  })
})

/** A synthetic photo: blue sky above a triangular mountain peaking at (peakX, peakY). */
function mountainImage(
  width: number,
  height: number,
  peakX: number,
  peakY: number,
) {
  const data = new Uint8ClampedArray(width * height * 4)
  const ridge = (x: number) => peakY + Math.abs(x - peakX) * 0.6
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const index = (y * width + x) * 4
      const sky = y < ridge(x)
      data[index] = sky ? 150 : 50
      data[index + 1] = sky ? 190 : 60
      data[index + 2] = sky ? 240 : 55
      data[index + 3] = 255
    }
  }
  return { data, width, height, ridge }
}

describe('detectSkyline', () => {
  it('finds the ridge line of a mountain', () => {
    const image = mountainImage(120, 80, 40, 20)
    const skyline = detectSkyline(image)
    expect(skyline).not.toBeNull()
    for (const x of [10, 40, 80, 110]) {
      expect(skyline![x] * 80).toBeGreaterThan(image.ridge(x) - 3)
      expect(skyline![x] * 80).toBeLessThan(image.ridge(x) + 3)
    }
  })

  it('builds a trail from the lower edge up to the summit', () => {
    const image = mountainImage(120, 80, 40, 20)
    const trail = trailFromSkyline(detectSkyline(image)!)
    const summit = trail[trail.length - 1]
    expect(summit.x * 120).toBeGreaterThan(36)
    expect(summit.x * 120).toBeLessThan(44)
    // The right edge is lower than the left, so the climb starts on the right.
    expect(trail[0].x).toBeGreaterThan(0.95)
  })

  it('gives up on images without a skyline', () => {
    const data = new Uint8ClampedArray(64 * 48 * 4).fill(128)
    expect(detectSkyline({ data, width: 64, height: 48 })).toBeNull()
  })
})

describe('panToShow', () => {
  // A 16:10 scene on a phone: 1350 wide in a 390-wide viewport, centred.
  const cover = coverFit(390, 844, 1.6, 'bottom')
  const trail = [
    { x: 0.14, y: 0.5 },
    { x: 0.58, y: 0.42 },
  ]

  it('pans a cropped trail into view without exposing an edge', () => {
    const pan = panToShow(trail, trail[0], cover, 390)
    expect(pan).toBeGreaterThan(0)
    expect(cover.offsetX + pan).toBeLessThanOrEqual(0)
  })

  it('leaves a trail that already fits alone', () => {
    const wide = coverFit(1600, 1000, 1.6, 'bottom')
    expect(panToShow(trail, trail[0], wide, 1600)).toBe(0)
  })
})
