import { describe, expect, it } from 'vitest'
import {
  GRADES,
  LIGHT_OFF,
  PALETTES,
  getLight,
  lightForStreak,
  lightForTime,
} from './light'

const at = (hours: number, minutes = 0) => new Date(2026, 9, 10, hours, minutes)

describe('lightForTime', () => {
  it('follows the day from night to dusk', () => {
    expect(lightForTime(at(2)).phase).toBe('night')
    expect(lightForTime(at(6, 15)).phase).toBe('dawn')
    expect(lightForTime(at(12)).phase).toBe('day')
    expect(lightForTime(at(18)).phase).toBe('golden')
    expect(lightForTime(at(19, 30)).phase).toBe('dusk')
    expect(lightForTime(at(23)).phase).toBe('night')
  })

  it('uses the exact palette at a keyframe', () => {
    expect(lightForTime(at(12)).palette).toEqual(PALETTES.day)
    expect(lightForTime(at(12)).grade).toEqual(GRADES.day)
  })

  it('blends smoothly between keyframes', () => {
    const halfway = lightForTime(at(7, 22)) // between dawn (6:15) and day (8:30)
    expect(halfway.grade.opacity).toBeLessThan(GRADES.dawn.opacity)
    expect(halfway.grade.opacity).toBeGreaterThan(GRADES.day.opacity)
    expect(halfway.palette.sky[0]).not.toBe(PALETTES.dawn.sky[0])
    expect(halfway.palette.sky[0]).not.toBe(PALETTES.day.sky[0])
  })
})

describe('lightForStreak', () => {
  it('warms from night to golden hour as the streak grows', () => {
    expect(lightForStreak(0).phase).toBe('night')
    expect(lightForStreak(8).phase).toBe('dawn')
    expect(lightForStreak(60).phase).toBe('golden')
    expect(lightForStreak(500).palette).toEqual(PALETTES.golden)
  })

  it('gets warmer every day', () => {
    const glow = (days: number) => lightForStreak(days).palette.glowOpacity
    expect(glow(5)).toBeGreaterThan(glow(1))
    expect(glow(30)).toBeGreaterThan(glow(5))
  })
})

describe('getLight', () => {
  it('can be switched off', () => {
    expect(getLight('off', at(12), 30)).toBe(LIGHT_OFF)
  })
})
