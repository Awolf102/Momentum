import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type ReactNode,
} from 'react'
import { DownloadIcon, TrashIcon, UploadIcon } from '@/components/icons'
import { resetStreak } from '@/features/streak'
import { cn } from '@/lib/cn'
import { exportBackup, importBackup } from '../lib/backup'

export function DataSettings() {
  const fileInput = useRef<HTMLInputElement>(null)
  const [message, setMessage] = useState<{
    tone: 'ok' | 'error'
    text: string
  } | null>(null)
  const [confirmingReset, setConfirmingReset] = useState(false)

  // The reset button asks for a second tap, then quietly disarms.
  useEffect(() => {
    if (!confirmingReset) return
    const timer = setTimeout(() => setConfirmingReset(false), 4000)
    return () => clearTimeout(timer)
  }, [confirmingReset])

  async function handleImport(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    try {
      const { added } = await importBackup(file)
      setMessage({
        tone: 'ok',
        text:
          added === 0
            ? 'Backup imported — everything in it was already here.'
            : `Imported ${added} ${added === 1 ? 'day' : 'days'} from your backup.`,
      })
    } catch (error) {
      setMessage({
        tone: 'error',
        text: error instanceof Error ? error.message : 'Import failed.',
      })
    }
  }

  function handleReset() {
    if (!confirmingReset) {
      setConfirmingReset(true)
      return
    }
    resetStreak()
    setConfirmingReset(false)
    setMessage({ tone: 'ok', text: 'Your streak history was cleared.' })
  }

  return (
    <div className="space-y-2">
      <ActionRow
        icon={<DownloadIcon />}
        label="Export backup"
        onClick={exportBackup}
      />
      <ActionRow
        icon={<UploadIcon />}
        label="Import backup"
        onClick={() => fileInput.current?.click()}
      />
      <input
        ref={fileInput}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={(event) => void handleImport(event)}
      />
      <ActionRow
        icon={<TrashIcon />}
        label={
          confirmingReset
            ? 'Tap again to erase all check-ins'
            : 'Reset streak history'
        }
        onClick={handleReset}
        danger
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
  )
}

interface ActionRowProps {
  icon: ReactNode
  label: string
  onClick: () => void
  danger?: boolean
}

function ActionRow({ icon, label, onClick, danger = false }: ActionRowProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-3 rounded-2xl bg-tint px-4 py-3 text-left text-sm font-medium transition hover:bg-line',
        danger && 'text-rose-300 light:text-rose-600',
      )}
    >
      <span className="text-base opacity-80">{icon}</span>
      {label}
    </button>
  )
}
