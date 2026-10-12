import { useId, useState } from 'react'
import { AlertIcon } from '@/components/icons'
import { blockedBeforeSending, currentPage } from '../lib/reach'
import { normalizeBaseUrl } from '../providers/openai'

/**
 * An OpenAI-compatible server's address, saved when the field loses focus,
 * with what the browser would refuse said before anything is sent, and
 * what a local server needs to allow (this page's origin).
 */
export function AddressField({
  value: saved,
  onSave,
  label = 'Address',
}: {
  value: string
  onSave: (address: string) => void
  label?: string
}) {
  // What's being typed; saved when the field loses focus.
  const [draft, setDraft] = useState<string | null>(null)
  const value = draft ?? saved
  const inputId = useId()
  const effective = normalizeBaseUrl(value)
  const page = currentPage()
  // Said before anything is sent: the browser would refuse it.
  const blocked = page && value.trim() && blockedBeforeSending(page, effective)

  return (
    <div>
      <label htmlFor={inputId} className="block text-xs text-fg-muted">
        {label}
      </label>
      <div className="mt-1 flex items-center rounded-2xl bg-tint px-4 py-1.5 ring-orange-300/60 focus-within:ring-2">
        <input
          id={inputId}
          type="url"
          inputMode="url"
          value={value}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={() => {
            onSave(value.trim())
            setDraft(null)
          }}
          onKeyDown={(event) =>
            event.key === 'Enter' && event.currentTarget.blur()
          }
          placeholder="http://localhost:11434/v1"
          spellCheck={false}
          autoComplete="off"
          className="min-w-0 flex-1 bg-transparent py-1.5 font-mono text-sm outline-none placeholder:text-fg-subtle focus-visible:outline-none"
        />
      </div>
      {value.trim() && effective !== value.trim() && (
        <p className="mt-1.5 text-xs text-fg-subtle">
          Requests go to <span className="font-mono">{effective}</span>
        </p>
      )}
      {blocked && (
        <p
          role="alert"
          className="mt-1.5 flex items-start gap-1.5 text-xs leading-relaxed text-amber-200 light:text-amber-700"
        >
          <AlertIcon className="mt-px shrink-0" />
          <span>
            {page.webkit ? 'Safari' : 'The browser'} won’t send anything to this
            address from here: this copy of Momentum is served over https, and a
            plain http address can’t be reached from it
            {page.webkit ? ', even on this computer' : ''}. Open Momentum from{' '}
            <span className="font-mono">http://localhost:4173</span> instead, or
            give the server an https address.
          </span>
        </p>
      )}
    </div>
  )
}

/** What a server on your own computer needs to allow, with this page's origin. */
export function OriginHelp() {
  const page = currentPage()
  const origin = page?.origin ?? ''
  return (
    <>
      <details className="mt-3 text-xs text-fg-subtle">
        <summary className="cursor-pointer text-fg-muted">
          Using Ollama on this computer?
        </summary>
        <p className="mt-2 leading-relaxed">
          Browsers only let a page talk to a local server that allows it. Start
          Ollama with{' '}
          <code className="rounded bg-tint px-1 py-0.5 font-mono break-all">
            OLLAMA_ORIGINS={origin}
          </code>{' '}
          set, then use the address above. Ollama doesn't need a key. With the
          Ollama app on a Mac, run{' '}
          <code className="rounded bg-tint px-1 py-0.5 font-mono break-all">
            launchctl setenv OLLAMA_ORIGINS "{origin}"
          </code>{' '}
          and quit and reopen it.
        </p>
      </details>
      <p className="mt-2 text-xs text-fg-subtle">
        This copy of Momentum is open at{' '}
        <span className="font-mono break-all text-fg-muted">{origin}</span>
        {page?.installed ? ', as an installed app' : ''}. That’s the origin a
        server must allow.
      </p>
    </>
  )
}
