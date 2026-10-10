import { describe, expect, it } from 'vitest'
import { silentWav } from './audio'
import { modelsForTask } from './format'

describe('a second of silence', () => {
  it('is a 16-bit mono WAV of zeros', async () => {
    const wav = silentWav(1, 16_000)
    const bytes = new Uint8Array(await wav.arrayBuffer())
    const view = new DataView(bytes.buffer)
    const text = (at: number, length: number) =>
      String.fromCharCode(...bytes.slice(at, at + length))
    expect(wav.type).toBe('audio/wav')
    expect(bytes.length).toBe(44 + 32_000)
    expect([text(0, 4), text(8, 4), text(12, 4), text(36, 4)]).toEqual([
      'RIFF',
      'WAVE',
      'fmt ',
      'data',
    ])
    expect(view.getUint16(22, true)).toBe(1)
    expect(view.getUint32(24, true)).toBe(16_000)
    expect(view.getUint16(34, true)).toBe(16)
    expect(bytes.slice(44).every((byte) => byte === 0)).toBe(true)
  })
})

describe('models suggested for a task', () => {
  const models = [
    { id: 'gpt-x' },
    { id: 'text-embedding-test' },
    { id: 'whisper-test' },
    { id: 'gpt-test-transcribe' },
  ]
  it('keeps transcribers for transcription, and out of chat', () => {
    expect(
      modelsForTask(models, 'transcription').map((model) => model.id),
    ).toEqual(['whisper-test', 'gpt-test-transcribe'])
    expect(modelsForTask(models, 'chat').map((model) => model.id)).toEqual([
      'gpt-x',
    ])
    // A server that lists none by those names offers everything.
    expect(modelsForTask([{ id: 'local' }], 'transcription')).toHaveLength(1)
  })
})
