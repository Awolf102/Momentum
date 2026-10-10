import { describe, expect, it } from 'vitest'
import { fillNoise, rms } from './noise'

function seeded(seed = 1) {
  let state = seed
  return () => (state = (state * 16807) % 2147483647) / 2147483647
}

describe('fillNoise', () => {
  for (const color of ['white', 'pink', 'brown'] as const) {
    it(`makes audible, unclipped ${color} noise`, () => {
      const samples = fillNoise(new Float32Array(48_000), color, seeded())
      const peak = Math.max(...samples.map(Math.abs))
      expect(peak).toBeLessThanOrEqual(1.05)
      expect(rms(samples)).toBeGreaterThan(0.03)
    })
  }

  it('makes brown noise darker than white (smoother sample to sample)', () => {
    const roughness = (samples: Float32Array) => {
      let total = 0
      for (let i = 1; i < samples.length; i++)
        total += Math.abs(samples[i] - samples[i - 1])
      return total / samples.length / rms(samples)
    }
    const white = fillNoise(new Float32Array(10_000), 'white', seeded(2))
    const brown = fillNoise(new Float32Array(10_000), 'brown', seeded(2))
    expect(roughness(brown)).toBeLessThan(roughness(white) / 5)
  })
})
