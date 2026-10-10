import { SOUNDS, type Layer, type SoundId } from './sounds'

const FADE = 1.2
const LOOKAHEAD = 0.4

/**
 * Mixes the ambient layers. The AudioContext is created on first play, which
 * always follows a click or key press (browsers require a user gesture).
 */
class AmbienceEngine {
  private context: AudioContext | null = null
  private master: GainNode | null = null
  private layers = new Map<SoundId, { layer: Layer; gain: GainNode }>()
  private timer: ReturnType<typeof setInterval> | undefined

  private ensureContext() {
    if (this.context && this.master)
      return { context: this.context, master: this.master }
    const context = new AudioContext()
    const master = context.createGain()
    master.gain.value = 0
    const limiter = context.createDynamicsCompressor()
    limiter.threshold.value = -10
    limiter.ratio.value = 6
    master.connect(limiter).connect(context.destination)
    this.context = context
    this.master = master
    return { context, master }
  }

  async play(sounds: readonly SoundId[], volume: number): Promise<void> {
    const { context } = this.ensureContext()
    if (context.state === 'suspended') await context.resume()
    this.setSounds(sounds)
    this.setVolume(volume)
    clearInterval(this.timer)
    this.timer = setInterval(() => this.schedule(), 100)
    this.schedule()
  }

  private schedule() {
    if (!this.context) return
    const until = this.context.currentTime + LOOKAHEAD
    for (const { layer } of this.layers.values()) layer.scheduleUntil(until)
  }

  setSounds(sounds: readonly SoundId[]): void {
    if (!this.context || !this.master) return
    const now = this.context.currentTime
    for (const id of sounds) {
      if (this.layers.has(id)) continue
      const layer = SOUNDS[id].create(this.context)
      const gain = this.context.createGain()
      gain.gain.setValueAtTime(0, now)
      gain.gain.linearRampToValueAtTime(1, now + FADE)
      layer.output.connect(gain).connect(this.master)
      this.layers.set(id, { layer, gain })
    }
    for (const [id, { layer, gain }] of this.layers) {
      if (sounds.includes(id)) continue
      gain.gain.cancelScheduledValues(now)
      gain.gain.setValueAtTime(gain.gain.value, now)
      gain.gain.linearRampToValueAtTime(0, now + FADE)
      this.layers.delete(id)
      setTimeout(
        () => {
          layer.stop()
          gain.disconnect()
        },
        FADE * 1000 + 100,
      )
    }
  }

  /** 0–1, eased so the slider feels even. */
  setVolume(volume: number): void {
    if (!this.context || !this.master) return
    const now = this.context.currentTime
    this.master.gain.cancelScheduledValues(now)
    this.master.gain.setValueAtTime(this.master.gain.value, now)
    this.master.gain.linearRampToValueAtTime(volume * volume * 0.9, now + 0.25)
  }

  stop(): void {
    this.setSounds([])
    clearInterval(this.timer)
    if (this.context) {
      const context = this.context
      setTimeout(
        () => {
          if (this.layers.size === 0) void context.suspend()
        },
        FADE * 1000 + 200,
      )
    }
  }
}

export const engine = new AmbienceEngine()
