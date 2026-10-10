import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type ReactNode,
} from 'react'
import { ActionRow } from '@/components/ActionRow'
import {
  CheckIcon,
  DownloadIcon,
  LockIcon,
  TrashIcon,
  UploadIcon,
} from '@/components/icons'
import { SettingsCard } from '@/components/SettingsCard'
import { Switch } from '@/components/Switch'
import { focusSessions, resetTimer } from '@/features/focus'
import { habitCheckIns, habitsStore } from '@/features/habits'
import { logEntries } from '@/features/log'
import { tasks } from '@/features/tasks'
import { resetStreak } from '@/features/streak'
import { cn } from '@/lib/cn'
import { requestPersistentStorage } from '@/lib/storage'
import { downloadBackup, importBackupFile } from '../lib/appBackup'
import { MIN_PASSWORD_LENGTH, PasswordNeededError } from '../lib/crypto'
import {
  formatBytes,
  readStorageStatus,
  type StorageStatus,
} from '../lib/storageStatus'

type Message = { tone: 'ok' | 'error'; text: string } | null

/** How restored records are counted in the import message. */
const RECORD_NAMES: Record<string, [one: string, many: string]> = {
  focusSessions: ['focus session', 'focus sessions'],
  logEntries: ['log line', 'log lines'],
  tasks: ['task', 'tasks'],
  habitCheckIns: ['habit day', 'habit days'],
}

export function DataSettings() {
  return (
    <>
      <StorageCard />
      <BackupCard />
      <ResetCard />
    </>
  )
}

function StorageCard() {
  const [status, setStatus] = useState<StorageStatus | null>(null)
  const refresh = () => void readStorageStatus().then(setStatus)
  useEffect(refresh, [])

  async function protect() {
    await requestPersistentStorage()
    refresh()
  }

  return (
    <SettingsCard
      title="On this device"
      description="Everything Momentum saves stays in this browser. Nothing is uploaded."
    >
      <dl className="space-y-2 text-sm">
        <Row label="Stored in">
          {status === null
            ? '…'
            : status.database
              ? "This browser's database"
              : 'Basic browser storage'}
        </Row>
        {status?.usedBytes != null && (
          <Row label="Space used">
            {formatBytes(status.usedBytes)}
            {status.quotaBytes
              ? ` of ${formatBytes(status.quotaBytes)} available`
              : ''}
          </Row>
        )}
        <Row label="Protected from clearing">
          {status?.persisted ? (
            <span className="inline-flex items-center gap-1.5">
              <CheckIcon className="text-orange-300 light:text-orange-500" />{' '}
              Yes
            </span>
          ) : (
            'No'
          )}
        </Row>
      </dl>
      {status && !status.persisted && (
        <div className="mt-3 space-y-2">
          <p className="text-xs leading-relaxed text-fg-subtle">
            Browsers can clear site data when space runs low, or after weeks
            without a visit. Installing Momentum, or asking the browser to
            protect it, makes that much less likely. Backups are the sure way.
          </p>
          <button
            type="button"
            onClick={() => void protect()}
            className="rounded-full bg-tint px-4 py-2 text-xs font-semibold transition hover:bg-line"
          >
            Ask the browser to protect it
          </button>
        </div>
      )}
    </SettingsCard>
  )
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 rounded-2xl bg-tint px-4 py-2.5">
      <dt className="text-fg-muted">{label}</dt>
      <dd className="text-right font-medium">{children}</dd>
    </div>
  )
}

function BackupCard() {
  const fileInput = useRef<HTMLInputElement>(null)
  const [includeKeys, setIncludeKeys] = useState(false)
  const [protect, setProtect] = useState(false)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  /** A protected backup waiting for its password. */
  const [locked, setLocked] = useState<File | null>(null)
  const [unlockWith, setUnlockWith] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<Message>(null)
  // Keys only ever leave the device encrypted.
  const protecting = protect || includeKeys
  const passwordProblem = !protecting
    ? null
    : password.length < MIN_PASSWORD_LENGTH
      ? `Use at least ${MIN_PASSWORD_LENGTH} characters.`
      : password !== confirm
        ? "The passwords don't match yet."
        : null

  async function handleExport() {
    if (passwordProblem) return
    setBusy(true)
    setMessage(null)
    try {
      await downloadBackup({
        includeSecrets: includeKeys,
        password: protecting ? password : undefined,
      })
      setPassword('')
      setConfirm('')
      setMessage({
        tone: 'ok',
        text: includeKeys
          ? 'Backup saved with your API keys, protected by your password.'
          : protecting
            ? 'Backup saved, protected by your password.'
            : 'Backup saved.',
      })
    } catch {
      setMessage({ tone: 'error', text: "The backup couldn't be created." })
    } finally {
      setBusy(false)
    }
  }

  async function runImport(file: File, withPassword?: string) {
    setBusy(true)
    setMessage(null)
    try {
      const report = await importBackupFile(file, {
        includeSecrets: includeKeys,
        password: withPassword,
      })
      setLocked(null)
      setUnlockWith('')
      const parts = [
        `Restored ${report.restored.length} ${report.restored.length === 1 ? 'section' : 'sections'}`,
      ]
      if (report.photos)
        parts.push(
          `${report.photos} ${report.photos === 1 ? 'photo' : 'photos'}`,
        )
      for (const [name, count] of Object.entries(report.records)) {
        const [one, many] = RECORD_NAMES[name] ?? ['record', 'records']
        parts.push(`${count} ${count === 1 ? one : many}`)
      }
      if (report.secrets)
        parts.push(
          `${report.secrets} API ${report.secrets === 1 ? 'key' : 'keys'}`,
        )
      let text = `${parts.join(', ')}.`
      if (report.skipped.length)
        text += ` ${report.skipped.length} couldn't be read and were left as they are.`
      if (report.hadSecrets && !includeKeys) {
        text +=
          ' The backup has API keys; turn on "Include API keys" and import again to restore them.'
      }
      setMessage({ tone: 'ok', text })
    } catch (error) {
      if (error instanceof PasswordNeededError) {
        setLocked(file)
        return
      }
      setMessage({
        tone: 'error',
        text: error instanceof Error ? error.message : 'Import failed.',
      })
    } finally {
      setBusy(false)
    }
  }

  function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (file) void runImport(file)
  }

  return (
    <SettingsCard
      title="Backup"
      description="One file with your streak, habits, tasks, log, focus sessions, settings, photos and AI usage. Importing adds to what's here rather than replacing it."
    >
      <div className="space-y-2">
        {/* Chosen before exporting or importing, so it's never a surprise. */}
        <SwitchRow
          label="Include API keys"
          hint="Off by default. Keys only leave this device encrypted."
          checked={includeKeys}
          onChange={setIncludeKeys}
        />
        <SwitchRow
          label="Protect with a password"
          hint={
            includeKeys
              ? 'Always on for a backup with API keys.'
              : 'Encrypted on this device; the file is unreadable without it.'
          }
          checked={protecting}
          onChange={setProtect}
          disabled={includeKeys}
        />
        {protecting && (
          <div className="space-y-2 rounded-2xl bg-tint p-3">
            <div className="grid gap-2 sm:grid-cols-2">
              <PasswordField
                label="Password"
                value={password}
                onChange={setPassword}
                autoComplete="new-password"
              />
              <PasswordField
                label="Confirm password"
                value={confirm}
                onChange={setConfirm}
                autoComplete="new-password"
              />
            </div>
            <p className="px-1 text-xs leading-relaxed text-fg-subtle">
              {password && passwordProblem
                ? passwordProblem
                : "Keep it somewhere safe: there's no way to open the backup without it."}
            </p>
          </div>
        )}
        <ActionRow
          icon={<DownloadIcon />}
          label={busy ? 'Working…' : 'Export backup'}
          onClick={() => void handleExport()}
          disabled={busy || Boolean(passwordProblem)}
        />
        <ActionRow
          icon={<UploadIcon />}
          label="Import backup"
          onClick={() => fileInput.current?.click()}
          disabled={busy}
        />
        <input
          ref={fileInput}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={handleFile}
        />
        {locked && (
          <form
            onSubmit={(event) => {
              event.preventDefault()
              void runImport(locked, unlockWith)
            }}
            className="space-y-2 rounded-2xl bg-tint p-3"
          >
            <p className="flex items-center gap-2 px-1 text-sm">
              <LockIcon className="shrink-0 text-base text-fg-muted" />
              <span>
                <span className="font-medium break-all">{locked.name}</span> is
                protected. Enter its password to import it.
              </span>
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <div className="w-full min-w-0 sm:w-auto sm:flex-1">
                <PasswordField
                  label="Backup password"
                  value={unlockWith}
                  onChange={setUnlockWith}
                  autoComplete="current-password"
                  autoFocus
                />
              </div>
              <button
                type="submit"
                disabled={busy || !unlockWith}
                className="rounded-xl bg-linear-to-br from-amber-300 to-orange-500 px-4 py-2.5 text-sm font-semibold text-orange-950 disabled:opacity-40"
              >
                {busy ? 'Unlocking…' : 'Unlock and import'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setLocked(null)
                  setUnlockWith('')
                  setMessage(null)
                }}
                className="rounded-xl px-3 py-2.5 text-sm font-semibold text-fg-muted transition hover:bg-line"
              >
                Cancel
              </button>
            </div>
          </form>
        )}
        {message && (
          <p
            role="status"
            className={cn(
              'pt-1 text-sm',
              message.tone === 'error'
                ? 'text-rose-300 light:text-rose-600'
                : 'text-fg-muted',
            )}
          >
            {message.text}
          </p>
        )}
      </div>
    </SettingsCard>
  )
}

function SwitchRow({
  label,
  hint,
  checked,
  onChange,
  disabled,
}: {
  label: string
  hint: string
  checked: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean
}) {
  return (
    <div className="flex items-center justify-between gap-4 px-1 pb-2">
      <div>
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-fg-subtle">{hint}</p>
      </div>
      <Switch
        checked={checked}
        onChange={onChange}
        label={label}
        disabled={disabled}
      />
    </div>
  )
}

function PasswordField({
  label,
  value,
  onChange,
  autoComplete,
  autoFocus,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  autoComplete: string
  autoFocus?: boolean
}) {
  return (
    <label className="block">
      <span className="sr-only">{label}</span>
      <input
        type="password"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={label}
        autoComplete={autoComplete}
        autoFocus={autoFocus}
        spellCheck={false}
        className="h-10 w-full rounded-xl bg-tint px-3 text-sm outline-none placeholder:text-fg-subtle focus-visible:outline-2"
      />
    </label>
  )
}

function ResetCard() {
  const [done, setDone] = useState<string | null>(null)
  return (
    <SettingsCard title="Start over">
      <div className="space-y-2">
        <ResetRow
          label="Reset streak history"
          confirm="Tap again to erase all check-ins"
          onReset={() => {
            resetStreak()
            setDone('Your streak history was cleared.')
          }}
        />
        <ResetRow
          label="Reset habits"
          confirm="Tap again to erase every habit and its history"
          onReset={() => {
            habitsStore.reset()
            void habitCheckIns.clear()
            setDone('Your habits were cleared.')
          }}
        />
        <ResetRow
          label="Reset tasks"
          confirm="Tap again to erase every task"
          onReset={() => {
            void tasks.clear()
            setDone('Your tasks were cleared.')
          }}
        />
        <ResetRow
          label="Reset log"
          confirm="Tap again to erase every line"
          onReset={() => {
            void logEntries.clear()
            setDone('Your log was cleared.')
          }}
        />
        <ResetRow
          label="Reset focus history"
          confirm="Tap again to erase all focus sessions"
          onReset={() => {
            void focusSessions.clear()
            resetTimer()
            setDone(
              'Your focus sessions were cleared. Settings and subjects are kept.',
            )
          }}
        />
      </div>
      {done && (
        <p role="status" className="pt-3 text-sm text-fg-muted">
          {done}
        </p>
      )}
    </SettingsCard>
  )
}

/** A reset that asks for a second tap, then quietly disarms. */
function ResetRow({
  label,
  confirm,
  onReset,
}: {
  label: string
  confirm: string
  onReset: () => void
}) {
  const [confirming, setConfirming] = useState(false)
  useEffect(() => {
    if (!confirming) return
    const timer = setTimeout(() => setConfirming(false), 4000)
    return () => clearTimeout(timer)
  }, [confirming])
  return (
    <ActionRow
      icon={<TrashIcon />}
      label={confirming ? confirm : label}
      onClick={() => {
        if (!confirming) return setConfirming(true)
        setConfirming(false)
        onReset()
      }}
      danger
    />
  )
}
