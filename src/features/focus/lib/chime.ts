/**
 * A soft bell when a phase ends, made with Web Audio (no sound files). The
 * audio context is created on a click (starting a session), so the chime can
 * still play later from a background tab.
 */
let context: AudioContext | null = null

function audio(): AudioContext | null {
  if (typeof AudioContext === 'undefined') return null
  try {
    context ??= new AudioContext()
    if (context.state === 'suspended') void context.resume()
    return context
  } catch {
    return null
  }
}

/** Call from a click or key press so later chimes are allowed to play. */
export function primeChime(): void {
  audio()
}

/** Rising notes when a focus session ends, falling when a break does. */
export function playChime(kind: 'focus-done' | 'break-done'): void {
  const ctx = audio()
  if (!ctx) return
  const notes =
    kind === 'focus-done' ? [659.25, 880, 1318.51] : [1046.5, 783.99]
  const start = ctx.currentTime + 0.03
  const master = ctx.createGain()
  master.gain.value = 0.16
  master.connect(ctx.destination)
  notes.forEach((frequency, index) => {
    const at = start + index * 0.2
    const envelope = ctx.createGain()
    envelope.gain.setValueAtTime(0, at)
    envelope.gain.linearRampToValueAtTime(1, at + 0.012)
    envelope.gain.exponentialRampToValueAtTime(0.0005, at + 1.8)
    envelope.connect(master)
    // A sine and a quiet, slightly sharp octave make a bell-like tone.
    for (const [ratio, level] of [
      [1, 1],
      [2.01, 0.18],
    ] as const) {
      const oscillator = ctx.createOscillator()
      oscillator.frequency.value = frequency * ratio
      const gain = ctx.createGain()
      gain.gain.value = level
      oscillator.connect(gain).connect(envelope)
      oscillator.start(at)
      oscillator.stop(at + 1.9)
    }
  })
}
