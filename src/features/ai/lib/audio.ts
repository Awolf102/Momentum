/**
 * Silence as a WAV file (16-bit mono PCM), for testing a transcription
 * connection with nothing anyone said.
 */
export function silentWav(seconds = 1, sampleRate = 16_000): Blob {
  const samples = Math.round(seconds * sampleRate)
  const buffer = new ArrayBuffer(44 + samples * 2)
  const view = new DataView(buffer)
  const text = (at: number, value: string) => {
    for (let index = 0; index < value.length; index++)
      view.setUint8(at + index, value.charCodeAt(index))
  }
  text(0, 'RIFF')
  view.setUint32(4, 36 + samples * 2, true)
  text(8, 'WAVE')
  text(12, 'fmt ')
  view.setUint32(16, 16, true) // the format chunk's size
  view.setUint16(20, 1, true) // PCM
  view.setUint16(22, 1, true) // mono
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * 2, true) // bytes a second
  view.setUint16(32, 2, true) // bytes a sample
  view.setUint16(34, 16, true) // bits a sample
  text(36, 'data')
  view.setUint32(40, samples * 2, true)
  return new Blob([buffer], { type: 'audio/wav' })
}
