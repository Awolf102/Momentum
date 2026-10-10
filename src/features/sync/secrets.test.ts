import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'
import { backupSecrets, restoreSecret } from '@/features/backup/lib/appBackup'
import { closeDb } from '@/lib/db/db'
import { DB_NAME } from '@/lib/db/schema'
import { getAllSecrets, setSecret } from '@/lib/secrets'

afterEach(async () => {
  await closeDb()
  await new Promise((resolve) => {
    const request = indexedDB.deleteDatabase(DB_NAME)
    request.onsuccess = request.onerror = () => resolve(undefined)
  })
})

describe('backups and sync', () => {
  it('leave out sync’s session and key, and never restore them', async () => {
    await setSecret('anthropic', 'sk-ant-test')
    await setSecret('sync:token', 'a-session')
    await setSecret('sync:key', 'a-key')
    expect(await backupSecrets()).toEqual({ anthropic: 'sk-ant-test' })
    await restoreSecret('sync:key', 'someone else’s key')
    await restoreSecret('openai', 'sk-test')
    expect(await getAllSecrets()).toEqual({
      anthropic: 'sk-ant-test',
      openai: 'sk-test',
      'sync:key': 'a-key',
      'sync:token': 'a-session',
    })
  })
})
