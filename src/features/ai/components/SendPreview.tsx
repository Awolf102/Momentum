import { useId, type ReactNode } from 'react'
import { LockIcon } from '@/components/icons'
import { Sheet } from '@/components/Sheet'
import { cn } from '@/lib/cn'
import { useStore } from '@/lib/store'
import { isCloud, namesInOrder, usageProviderOf } from '../chain'
import { useChatRoute } from '../hooks/useChatRoute'
import { formatCost, formatTokenEstimate } from '../lib/format'
import { usageKey } from '../lib/usage'
import { PROVIDERS } from '../providers/meta'
import { aiSettingsStore, entryModel } from '../store'
import type { ProviderId } from '../types'

/** One thing that would be sent: a note, a document… */
export interface SendItem {
  id: string
  title: string
  /** How much of it, e.g. "12 passages". */
  detail: string
  icon?: ReactNode
}

interface SendPreviewProps {
  open: boolean
  onClose: () => void
  title: string
  /** What the request is for, in a sentence or two. */
  purpose: ReactNode
  provider: ProviderId
  model: string
  /**
   * A chat request: it goes to the first of chat's providers that can
   * answer, so they're named in order (and `provider`/`model` are only
   * where it goes when nothing in the list is set up).
   */
  chat?: boolean
  items: readonly SendItem[]
  /** With `onToggle`, each item gets a box: these are unticked (not sent). */
  skipped?: ReadonlySet<string>
  onToggle?: (id: string, send: boolean) => void
  /** Estimated tokens of what's ticked. */
  tokens: number
  /**
   * Said instead of the tokens, for what isn't counted in them (a
   * recording's length, say); there's no cost estimate then.
   */
  size?: string
  sendLabel: string
  onSend: () => void
}

/**
 * Before an AI feature sends anything: exactly what goes, to which provider
 * and model, about how much (and what it costs, when you've set a price).
 * Nothing is sent until "Send" is pressed.
 */
export function SendPreview({
  open,
  onClose,
  title,
  purpose,
  provider: givenProvider,
  model: givenModel,
  chat = false,
  items,
  skipped,
  onToggle,
  tokens,
  size,
  sendLabel,
  onSend,
}: SendPreviewProps) {
  const { prices } = useStore(aiSettingsStore)
  const route = useChatRoute()
  const first = chat ? route.first : undefined
  const fallbacks = chat ? route.fallbacks : []
  const provider = first?.provider ?? givenProvider
  const model = first ? entryModel(first) : givenModel
  const price =
    prices[usageKey(first ? usageProviderOf(first) : provider, model)]
  const label = first?.name ?? PROVIDERS[provider].label
  // The model on this device reads it here: nothing is sent, or paid for.
  const local = PROVIDERS[provider].local
  // Fallbacks that would send it somewhere: to a server, or the cloud.
  const sentOn = fallbacks.filter((entry) => !PROVIDERS[entry.provider].local)
  const cloudOn = fallbacks.filter(isCloud)
  const sending = items.filter((item) => !skipped?.has(item.id)).length
  const listId = useId()

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={sending === 0}
            onClick={onSend}
            className="rounded-full bg-linear-to-br from-amber-300 to-orange-500 px-5 py-2.5 text-sm font-semibold text-orange-950 shadow-[0_10px_24px_-12px_rgb(249_115_22/0.8)] transition hover:shadow-[0_12px_28px_-10px_rgb(249_115_22/0.9)] active:scale-95 disabled:pointer-events-none disabled:opacity-40"
          >
            {sendLabel}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full px-4 py-2.5 text-sm font-semibold text-fg-muted transition hover:bg-tint"
          >
            Cancel
          </button>
        </div>
      }
    >
      <div className="space-y-5 pb-2">
        <p className="text-sm leading-relaxed text-fg-muted">{purpose}</p>

        <dl className="space-y-2 text-sm">
          <div className="flex items-baseline justify-between gap-4 rounded-2xl bg-tint px-4 py-2.5">
            <dt className="shrink-0 text-fg-muted">
              {local ? 'Read by' : 'Sent to'}
            </dt>
            <dd className="min-w-0 text-right font-medium">
              {label}
              <span className="block font-mono text-xs font-normal break-all text-fg-subtle">
                {model}
              </span>
            </dd>
          </div>
          {fallbacks.length > 0 && (
            <div className="flex items-baseline justify-between gap-4 rounded-2xl bg-tint px-4 py-2.5">
              <dt className="shrink-0 text-fg-muted">If it can’t answer</dt>
              <dd className="min-w-0 text-right font-medium">
                {fallbacks.map((entry) => (
                  <span key={entry.id} className="block">
                    {entry.name}
                    <span className="ml-1.5 font-mono text-xs font-normal break-all text-fg-subtle">
                      {entryModel(entry)}
                    </span>
                  </span>
                ))}
              </dd>
            </div>
          )}
          <div className="flex items-baseline justify-between gap-4 rounded-2xl bg-tint px-4 py-2.5">
            <dt className="shrink-0 text-fg-muted">Size</dt>
            <dd className="text-right font-medium">
              {size ?? formatTokenEstimate(tokens)}
              {price && !size && (
                <span className="block text-xs font-normal text-fg-subtle">
                  about {formatCost((tokens * price.input) / 1_000_000)}
                </span>
              )}
            </dd>
          </div>
        </dl>

        <div>
          <p
            id={listId}
            className="mb-2 text-[11px] font-semibold tracking-[0.14em] text-fg-subtle uppercase"
          >
            What’s sent ({sending} of {items.length})
          </p>
          <ul aria-labelledby={listId} className="space-y-1.5">
            {items.map((item) => {
              const ticked = !skipped?.has(item.id)
              const content = (
                <>
                  {item.icon && (
                    <span className="shrink-0 text-base text-fg-subtle">
                      {item.icon}
                    </span>
                  )}
                  <span className="min-w-0 flex-1">
                    <span
                      className={cn(
                        'block truncate',
                        !ticked && 'text-fg-subtle line-through',
                      )}
                    >
                      {item.title}
                    </span>
                    <span className="block text-xs text-fg-subtle">
                      {ticked ? item.detail : 'Not sent'}
                    </span>
                  </span>
                </>
              )
              return (
                <li key={item.id}>
                  {onToggle ? (
                    <label className="flex cursor-pointer items-center gap-3 rounded-2xl bg-tint px-4 py-2.5 text-sm">
                      <input
                        type="checkbox"
                        checked={ticked}
                        onChange={(event) =>
                          onToggle(item.id, event.target.checked)
                        }
                        className="size-4 shrink-0 accent-orange-400"
                      />
                      {content}
                    </label>
                  ) : (
                    <div className="flex items-center gap-3 rounded-2xl bg-tint px-4 py-2.5 text-sm">
                      {content}
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        </div>

        {!price && !size && !local && (
          <p className="text-xs leading-relaxed text-fg-subtle">
            Add this model’s price under Usage to see what a request costs.
          </p>
        )}
        <p className="flex items-start gap-2 text-xs leading-relaxed text-fg-subtle">
          <LockIcon className="mt-px shrink-0" />
          {local
            ? 'Read by the model running on this device: none of it leaves this device.'
            : `Sent straight from this browser to ${label}, with your key. Nothing else is sent.`}
          {sentOn.length > 0 &&
            ` If ${local ? 'it' : label} can’t answer, it goes to ${namesInOrder(sentOn)} instead${cloudOn.length > 0 ? ` (${namesInOrder(cloudOn)} ${cloudOn.length === 1 ? 'is a cloud service you allowed' : 'are cloud services you allowed'} as a fallback)` : ''}.`}
        </p>
      </div>
    </Sheet>
  )
}
