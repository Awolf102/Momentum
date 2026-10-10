import { fillNoise, type NoiseColor } from './noise'

/**
 * Three ambient soundscapes built from filtered noise with the Web Audio API:
 * wind (gusting band-passed noise), rain (a soft hiss plus individual drops)
 * and a quiet fire (a low roar plus crackles).
 */
export type SoundId = 'wind' | 'rain' | 'fire'

export interface Layer {
  /** Connect this to the mix. */
  output: GainNode
  /** Schedules random events (drops, crackles) up to `time` on the context's clock. */
  scheduleUntil(time: number): void
  stop(): void
}

const buffers = new WeakMap<BaseAudioContext, Map<NoiseColor, AudioBuffer>>()

function noiseBuffer(
  context: BaseAudioContext,
  color: NoiseColor,
): AudioBuffer {
  let cache = buffers.get(context)
  if (!cache) buffers.set(context, (cache = new Map()))
  let buffer = cache.get(color)
  if (!buffer) {
    // Four seconds, two channels of independent noise for a little width.
    buffer = context.createBuffer(2, context.sampleRate * 4, context.sampleRate)
    fillNoise(buffer.getChannelData(0), color)
    fillNoise(buffer.getChannelData(1), color)
    cache.set(color, buffer)
  }
  return buffer
}

function loop(
  context: BaseAudioContext,
  color: NoiseColor,
): AudioBufferSourceNode {
  const source = context.createBufferSource()
  source.buffer = noiseBuffer(context, color)
  source.loop = true
  // Start at a random point so layers never line up.
  source.start(0, Math.random() * 4)
  return source
}

function lfo(
  context: BaseAudioContext,
  frequency: number,
  depth: number,
  target: AudioParam,
): OscillatorNode {
  const oscillator = context.createOscillator()
  oscillator.frequency.value = frequency
  const gain = context.createGain()
  gain.gain.value = depth
  oscillator.connect(gain).connect(target)
  oscillator.start()
  return oscillator
}

function wind(context: BaseAudioContext): Layer {
  const output = context.createGain()
  const source = loop(context, 'pink')
  const band = context.createBiquadFilter()
  band.type = 'bandpass'
  band.frequency.value = 520
  band.Q.value = 0.9
  const level = context.createGain()
  level.gain.value = 0.8
  source.connect(band).connect(level).connect(output)
  // Two slow, unrelated LFOs make gusts that never quite repeat.
  const sweeps = [
    lfo(context, 0.071, 260, band.frequency),
    lfo(context, 0.113, 0.22, level.gain),
    lfo(context, 0.031, 0.18, level.gain),
  ]
  // A faint whistle through the trees.
  const whistleSource = loop(context, 'white')
  const whistle = context.createBiquadFilter()
  whistle.type = 'bandpass'
  whistle.frequency.value = 1400
  whistle.Q.value = 9
  const whistleLevel = context.createGain()
  whistleLevel.gain.value = 0.05
  whistleSource.connect(whistle).connect(whistleLevel).connect(output)
  sweeps.push(lfo(context, 0.053, 380, whistle.frequency))
  return {
    output,
    scheduleUntil() {},
    stop() {
      for (const node of [source, whistleSource, ...sweeps]) node.stop()
    },
  }
}

/** Random events: a short filtered noise burst with an envelope. */
function burst(
  context: BaseAudioContext,
  destination: AudioNode,
  time: number,
  options: {
    duration: number
    gain: number
    frequency: number
    type: BiquadFilterType
    q?: number
  },
) {
  const source = context.createBufferSource()
  source.buffer = noiseBuffer(context, 'white')
  const filter = context.createBiquadFilter()
  filter.type = options.type
  filter.frequency.value = options.frequency
  filter.Q.value = options.q ?? 1
  const envelope = context.createGain()
  envelope.gain.setValueAtTime(0, time)
  envelope.gain.linearRampToValueAtTime(options.gain, time + 0.002)
  envelope.gain.exponentialRampToValueAtTime(0.0001, time + options.duration)
  source.connect(filter).connect(envelope).connect(destination)
  source.start(time, Math.random() * 3)
  source.stop(time + options.duration + 0.02)
}

function rain(context: BaseAudioContext): Layer {
  const output = context.createGain()
  const source = loop(context, 'pink')
  const highpass = context.createBiquadFilter()
  highpass.type = 'highpass'
  highpass.frequency.value = 450
  const lowpass = context.createBiquadFilter()
  lowpass.type = 'lowpass'
  lowpass.frequency.value = 7000
  const level = context.createGain()
  level.gain.value = 0.6
  source.connect(highpass).connect(lowpass).connect(level).connect(output)
  const sway = lfo(context, 0.09, 0.08, level.gain)

  let next = context.currentTime
  return {
    output,
    scheduleUntil(time) {
      while (next < time) {
        burst(context, output, next, {
          duration: 0.015 + Math.random() * 0.04,
          gain: 0.04 + Math.random() * 0.12,
          frequency: 1800 + Math.random() * 4500,
          type: 'bandpass',
          q: 2,
        })
        next += 0.008 + Math.random() * 0.05
      }
    },
    stop() {
      source.stop()
      sway.stop()
    },
  }
}

function fire(context: BaseAudioContext): Layer {
  const output = context.createGain()
  const source = loop(context, 'brown')
  const lowpass = context.createBiquadFilter()
  lowpass.type = 'lowpass'
  lowpass.frequency.value = 420
  const level = context.createGain()
  level.gain.value = 0.42
  source.connect(lowpass).connect(level).connect(output)
  const flicker = lfo(context, 0.27, 0.15, level.gain)

  let next = context.currentTime
  return {
    output,
    scheduleUntil(time) {
      while (next < time) {
        // Crackles come in little clusters, with the odd louder pop.
        const pop = Math.random() < 0.12
        burst(context, output, next, {
          duration: pop
            ? 0.03 + Math.random() * 0.04
            : 0.004 + Math.random() * 0.012,
          gain: pop ? 0.25 + Math.random() * 0.2 : 0.05 + Math.random() * 0.12,
          frequency: pop
            ? 900 + Math.random() * 800
            : 2200 + Math.random() * 3000,
          type: pop ? 'bandpass' : 'highpass',
        })
        next +=
          Math.random() < 0.3
            ? 0.02 + Math.random() * 0.06
            : 0.12 + Math.random() * 0.6
      }
    },
    stop() {
      source.stop()
      flicker.stop()
    },
  }
}

export const SOUNDS: Record<
  SoundId,
  { label: string; create: (context: BaseAudioContext) => Layer }
> = {
  wind: { label: 'Wind', create: wind },
  rain: { label: 'Rain', create: rain },
  fire: { label: 'Fire', create: fire },
}
