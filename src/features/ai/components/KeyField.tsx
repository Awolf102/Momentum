import { useId, useState, type FormEvent } from 'react'
import { KeyIcon } from '@/components/icons'
import { deleteSecret, savedSecretsStore, setSecret } from '@/lib/secrets'
import { useStore } from '@/lib/store'
import { PROVIDERS } from '../providers/meta'
import type { ProviderId } from '../types'

interface KeyFieldProps {
  provider: ProviderId
  onChange?: () => void
}

/**
 * Saves a provider's API key on this device. Once saved, only a masked hint
 * is shown; the key itself is never displayed again.
 */
export function KeyField({ provider, onChange }: KeyFieldProps) {
  const meta = PROVIDERS[provider]
  const hint = useStore(savedSecretsStore).get(provider)
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState('')
  const [busy, setBusy] = useState(false)
  const inputId = useId()

  async function save(event: FormEvent) {
    event.preventDefault()
    if (!value.trim()) return
    setBusy(true)
    await setSecret(provider, value)
    setValue('')
    setEditing(false)
    setBusy(false)
    onChange?.()
  }

  async function remove() {
    await deleteSecret(provider)
    onChange?.()
  }

  if (hint && !editing) {
    return (
      <div className="flex items-center gap-2 rounded-2xl bg-tint py-1.5 pr-1.5 pl-4">
        <KeyIcon className="shrink-0 text-fg-subtle" />
        <span
          className="min-w-0 flex-1 truncate font-mono text-xs text-fg-muted"
          aria-label={`${meta.label} key saved`}
        >
          {hint}
        </span>
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="rounded-full px-3 py-1.5 text-xs font-semibold transition hover:bg-line"
        >
          Replace
        </button>
        <button
          type="button"
          onClick={() => void remove()}
          className="rounded-full px-3 py-1.5 text-xs font-semibold text-rose-300 transition hover:bg-line light:text-rose-600"
        >
          Remove
        </button>
      </div>
    )
  }

  return (
    <form
      onSubmit={(event) => void save(event)}
      className="flex items-center gap-2 rounded-2xl bg-tint py-1.5 pr-1.5 pl-4 ring-orange-300/60 focus-within:ring-2"
    >
      <label htmlFor={inputId} className="sr-only">
        {meta.label} API key
      </label>
      <input
        id={inputId}
        type="password"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder={meta.needsKey ? meta.keyPlaceholder : 'Key (optional)'}
        autoComplete="off"
        spellCheck={false}
        data-1p-ignore
        data-lpignore="true"
        autoFocus={editing}
        className="min-w-0 flex-1 bg-transparent py-1.5 font-mono text-sm outline-none placeholder:font-sans placeholder:text-fg-subtle focus-visible:outline-none"
      />
      {editing && (
        <button
          type="button"
          onClick={() => {
            setEditing(false)
            setValue('')
          }}
          className="rounded-full px-3 py-1.5 text-xs font-semibold text-fg-muted transition hover:bg-line"
        >
          Cancel
        </button>
      )}
      <button
        type="submit"
        disabled={!value.trim() || busy}
        className="rounded-full bg-linear-to-br from-amber-300 to-orange-500 px-3.5 py-1.5 text-xs font-semibold text-orange-950 transition disabled:opacity-40"
      >
        Save
      </button>
    </form>
  )
}
