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
  TrashIcon,
  UploadIcon,
} from '@/components/icons'
import { SettingsCard } from '@/components/SettingsCard'
import { Switch } from '@/components/Switch'
import { focusSessions, resetTimer } from '@/features/focus'
import { logEntries } from '@/features/log'
import { resetStreak } from '@/features/streak'
import { cn } from '@/lib/cn'
import { requestPersistentStorage } from '@/lib/storage'
import { downloadBackup, importBackupFile } from '../lib/appBackup'
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
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<Message>(null)

  async function handleExport() {
    setBusy(true)
    try {
      await downloadBackup({ includeSecrets: includeKeys })
      setMessage({
        tone: 'ok',
        text: includeKeys
          ? 'Backup saved, including your API keys. Keep the file somewhere private.'
          : 'Backup saved.',
      })
    } catch {
      setMessage({ tone: 'error', text: "The backup couldn't be created." })
    } finally {
      setBusy(false)
    }
  }

  async function handleImport(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setBusy(true)
    try {
      const report = await importBackupFile(file, {
        includeSecrets: includeKeys,
      })
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
      setMessage({
        tone: 'error',
        text: error instanceof Error ? error.message : 'Import failed.',
      })
    } finally {
      setBusy(false)
    }
  }

  return (
    <SettingsCard
      title="Backup"
      description="One file with your streak, log, focus sessions, settings, photos and AI usage. Importing adds to what's here rather than replacing it."
    >
      <div className="space-y-2">
        {/* Chosen before exporting or importing, so it's never a surprise. */}
        <div className="flex items-center justify-between gap-4 px-1 pb-2">
          <div>
            <p className="text-sm font-medium">Include API keys</p>
            <p className="text-xs text-fg-subtle">
              Off by default. A backup with keys must be kept private.
            </p>
          </div>
          <Switch
            checked={includeKeys}
            onChange={setIncludeKeys}
            label="Include API keys"
          />
        </div>
        <ActionRow
          icon={<DownloadIcon />}
          label="Export backup"
          onClick={() => void handleExport()}
          disabled={busy}
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
          onChange={(event) => void handleImport(event)}
        />
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
