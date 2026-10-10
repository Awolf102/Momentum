import { isRecord } from '@/lib/guards'
import { createPersistentStore } from '@/lib/persistentStore'
import { createStore } from '@/lib/store'
import { engine } from './lib/engine'
import { SOUNDS, type SoundId } from './lib/sounds'

interface AmbienceSettings {
  /** The sounds in the mix (remembered between visits). */
  sounds: SoundId[]
  volume: number
}

const SOUND_IDS = Object.keys(SOUNDS) as SoundId[]

export const ambienceStore = createPersistentStore<AmbienceSettings>({
  key: 'momentum.ambience',
  version: 1,
  defaultValue: { sounds: ['rain'], volume: 0.6 },
  parse(data) {
    if (!isRecord(data)) return null
    return {
      sounds: Array.isArray(data.sounds)
        ? SOUND_IDS.filter((id) => (data.sounds as unknown[]).includes(id))
        : ['rain'],
      volume:
        typeof data.volume === 'number'
          ? Math.min(1, Math.max(0, data.volume))
          : 0.6,
    }
  },
})

/** Playing is never restored on load: sound only starts when you ask for it. */
export const playingStore = createStore(false)

export function play(): void {
  const { sounds, volume } = ambienceStore.get()
  const mix: SoundId[] = sounds.length > 0 ? sounds : ['rain']
  if (sounds.length === 0)
    ambienceStore.set((previous) => ({ ...previous, sounds: mix }))
  playingStore.set(true)
  void engine.play(mix, volume)
}

export function pause(): void {
  playingStore.set(false)
  engine.stop()
}

export function togglePlaying(): void {
  if (playingStore.get()) pause()
  else play()
}

/** Adds or removes a sound; turning one on starts playback. */
export function toggleSound(id: SoundId): void {
  const { sounds } = ambienceStore.get()
  const next = sounds.includes(id)
    ? sounds.filter((sound) => sound !== id)
    : [...sounds, id]
  ambienceStore.set((previous) => ({ ...previous, sounds: next }))
  if (next.length === 0) {
    pause()
  } else if (playingStore.get()) {
    engine.setSounds(next)
  } else {
    play()
  }
}

/** Makes sure a sound is in the mix and playing. */
export function playSound(id: SoundId): void {
  const { sounds } = ambienceStore.get()
  const next = sounds.includes(id) ? sounds : [...sounds, id]
  ambienceStore.set((previous) => ({ ...previous, sounds: next }))
  if (playingStore.get()) engine.setSounds(next)
  else play()
}

export function setVolume(volume: number): void {
  ambienceStore.set((previous) => ({ ...previous, volume }))
  engine.setVolume(volume)
}
