import { describe, expect, it } from 'vitest'
import {
  createMemoryBackend,
  createPersistentStore,
  StoreRegistry,
} from '@/lib/persistentStore'
import {
  createBackup,
  parseBackup,
  restoreBackup,
  type BackupSources,
} from './backup'

function device() {
  const registry = new StoreRegistry()
  const streak = createPersistentStore<{ days: string[] }>({
    key: 'momentum.streak',
    version: 1,
    defaultValue: { days: [] },
    parse: (data) => data as { days: string[] },
    merge: (current, incoming) => ({
      days: [...new Set([...current.days, ...incoming.days])].sort(),
    }),
    registry,
  })
  const settings = createPersistentStore<{ theme: string }>({
    key: 'momentum.appearance',
    version: 1,
    defaultValue: { theme: 'dark' },
    parse: (data) => data as { theme: string },
    registry,
  })
  const photos = new Map<string, Blob>()
  const secrets: Record<string, string> = {}
  const sources: BackupSources = {
    registry,
    listPhotos: async () => [...photos].map(([key, blob]) => ({ key, blob })),
    putPhoto: async (key, blob) => void photos.set(key, blob),
    getSecrets: async () => ({ ...secrets }),
    setSecret: async (name, value) => void (secrets[name] = value),
  }
  return { registry, streak, settings, photos, secrets, sources }
}

describe('backups', () => {
  it('round-trips every store, photo and (opt-in) key', async () => {
    const source = device()
    await source.registry.hydrate(createMemoryBackend())
    source.streak.set({ days: ['2026-10-09', '2026-10-10'] })
    source.settings.set({ theme: 'light' })
    source.photos.set(
      'p1:full',
      new Blob([new Uint8Array([1, 2, 3])], { type: 'image/jpeg' }),
    )
    source.secrets.anthropic = 'sk-ant-secret'

    const backup = await createBackup(source.sources, { includeSecrets: false })
    expect(backup.secrets).toBeUndefined()
    const withKeys = await createBackup(source.sources, {
      includeSecrets: true,
    })
    expect(withKeys.secrets).toEqual({ anthropic: 'sk-ant-secret' })

    const target = device()
    await target.registry.hydrate(createMemoryBackend())
    target.streak.set({ days: ['2026-10-01'] })
    const report = await restoreBackup(
      parseBackup(JSON.stringify(withKeys)),
      target.sources,
      {
        includeSecrets: true,
      },
    )

    expect(target.settings.get()).toEqual({ theme: 'light' })
    // The streak merges: nothing on the target device is lost.
    expect(target.streak.get().days).toEqual([
      '2026-10-01',
      '2026-10-09',
      '2026-10-10',
    ])
    const photo = target.photos.get('p1:full')!
    expect([...new Uint8Array(await photo.arrayBuffer())]).toEqual([1, 2, 3])
    expect(target.secrets).toEqual({ anthropic: 'sk-ant-secret' })
    expect(report).toMatchObject({ photos: 1, secrets: 1 })
  })

  it('leaves keys out unless the importer agrees', async () => {
    const target = device()
    const backup = parseBackup(
      JSON.stringify({
        format: 'momentum-backup',
        version: 2,
        stores: {},
        photos: [],
        secrets: { openai: 'sk-x' },
      }),
    )
    await restoreBackup(backup, target.sources, { includeSecrets: false })
    expect(target.secrets).toEqual({})
  })

  it('still reads version 1 backups (streak only)', () => {
    const backup = parseBackup(
      JSON.stringify({
        format: 'momentum-backup',
        exportedAt: '2026-10-10T00:00:00Z',
        streak: { version: 1, data: { checkIns: {} } },
      }),
    )
    expect(Object.keys(backup.stores)).toEqual(['momentum.streak'])
  })

  it('rejects other files and newer formats', () => {
    expect(() => parseBackup('not json')).toThrow(/isn't a Momentum backup/)
    expect(() => parseBackup(JSON.stringify({ format: 'other' }))).toThrow()
    expect(() =>
      parseBackup(JSON.stringify({ format: 'momentum-backup', version: 99 })),
    ).toThrow(/newer version/)
  })

  it('keeps data for stores this version has not loaded, and skips damaged data', async () => {
    const target = device()
    const backend = createMemoryBackend()
    await target.registry.hydrate(backend)
    const report = await restoreBackup(
      parseBackup(
        JSON.stringify({
          format: 'momentum-backup',
          version: 2,
          stores: {
            'momentum.future': { version: 1, data: { tasks: [] } },
            'momentum.appearance': { version: 99, data: {} },
          },
          photos: [],
        }),
      ),
      target.sources,
      { includeSecrets: false },
    )
    expect(report.restored).toEqual(['momentum.future'])
    expect(report.skipped).toEqual(['momentum.appearance'])
    expect(backend.entries.get('momentum.future')).toEqual({
      version: 1,
      data: { tasks: [] },
    })
  })
})
