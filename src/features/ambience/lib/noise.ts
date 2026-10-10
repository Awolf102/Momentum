/**
 * Noise colours, generated rather than recorded so Momentum ships no audio
 * files and works offline. `random` is injectable for tests.
 */
export type NoiseColor = 'white' | 'pink' | 'brown'

export function fillNoise(
  samples: Float32Array,
  color: NoiseColor,
  random: () => number = Math.random,
): Float32Array {
  // Pink: Paul Kellet's filter. Brown: leaky integration of white noise.
  let b0 = 0,
    b1 = 0,
    b2 = 0,
    b3 = 0,
    b4 = 0,
    b5 = 0,
    b6 = 0
  let brown = 0
  for (let index = 0; index < samples.length; index++) {
    const white = random() * 2 - 1
    if (color === 'white') {
      samples[index] = white
    } else if (color === 'pink') {
      b0 = 0.99886 * b0 + white * 0.0555179
      b1 = 0.99332 * b1 + white * 0.0750759
      b2 = 0.969 * b2 + white * 0.153852
      b3 = 0.8665 * b3 + white * 0.3104856
      b4 = 0.55 * b4 + white * 0.5329522
      b5 = -0.7616 * b5 - white * 0.016898
      samples[index] =
        (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11
      b6 = white * 0.115926
    } else {
      brown = (brown + 0.02 * white) / 1.02
      samples[index] = brown * 3.5
    }
  }
  return samples
}

/** Root-mean-square level of a signal (used to check the sounds aren't silent). */
export function rms(samples: Float32Array): number {
  let sum = 0
  for (const sample of samples) sum += sample * sample
  return Math.sqrt(sum / Math.max(1, samples.length))
}
