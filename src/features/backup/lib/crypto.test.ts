import { describe, expect, it } from 'vitest'
import {
  asEncryptedBackup,
  encryptBackup,
  PasswordNeededError,
  unlockBackupText,
  WrongPasswordError,
} from './crypto'

// The lowest count a file may ask for, to keep the tests quick.
const options = { iterations: 100_000, exportedAt: '2026-10-10T00:00:00.000Z' }
const backup = JSON.stringify({
  format: 'momentum-backup',
  version: 3,
  secrets: { anthropic: 'sk-ant-test' },
})

describe('password-protected backups', () => {
  it('round-trips with the right password', async () => {
    const file = JSON.stringify(
      await encryptBackup(backup, 'correct horse battery', options),
    )
    // Nothing readable is left in the file.
    expect(file).not.toContain('sk-ant-test')
    expect(file).not.toContain('momentum-backup"')
    expect(await unlockBackupText(file, 'correct horse battery')).toBe(backup)
  })

  it('treats the same password typed differently as the same', async () => {
    // "é" as one character, then as "e" plus an accent.
    const file = JSON.stringify(
      await encryptBackup(backup, 'café-time', options),
    )
    expect(await unlockBackupText(file, 'café-time')).toBe(backup)
  })

  it('refuses a wrong password, or a file that was altered', async () => {
    const encrypted = await encryptBackup(
      backup,
      'correct horse battery',
      options,
    )
    await expect(
      unlockBackupText(JSON.stringify(encrypted), 'wrong password'),
    ).rejects.toBeInstanceOf(WrongPasswordError)
    const altered = { ...encrypted, data: `A${encrypted.data.slice(1)}` }
    await expect(
      unlockBackupText(JSON.stringify(altered), 'correct horse battery'),
    ).rejects.toBeInstanceOf(WrongPasswordError)
  })

  it('asks for a password, and leaves ordinary backups alone', async () => {
    const file = JSON.stringify(
      await encryptBackup(backup, 'a password', options),
    )
    await expect(unlockBackupText(file)).rejects.toBeInstanceOf(
      PasswordNeededError,
    )
    expect(await unlockBackupText(backup)).toBe(backup)
    expect(await unlockBackupText('not json')).toBe('not json')
  })

  it('rejects files asking for too little or too much work', async () => {
    const encrypted = await encryptBackup(backup, 'a password', options)
    expect(() =>
      asEncryptedBackup({
        ...encrypted,
        kdf: { ...encrypted.kdf, iterations: 1 },
      }),
    ).toThrow(/damaged/)
    expect(() =>
      asEncryptedBackup({
        ...encrypted,
        kdf: { ...encrypted.kdf, iterations: 1e12 },
      }),
    ).toThrow(/damaged/)
    expect(() => asEncryptedBackup({ ...encrypted, version: 99 })).toThrow(
      /newer version/,
    )
  })
})
