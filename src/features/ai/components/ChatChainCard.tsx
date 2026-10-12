import { lazy, Suspense, useEffect, useId, useState } from 'react'
import {
  AlertIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  PlusIcon,
  TrashIcon,
} from '@/components/icons'
import {
  SegmentedControl,
  type SegmentedOption,
} from '@/components/SegmentedControl'
import { SettingsCard } from '@/components/SettingsCard'
import { Switch } from '@/components/Switch'
import { cn } from '@/lib/cn'
import { deleteSecret, savedSecretsStore } from '@/lib/secrets'
import { useStore } from '@/lib/store'
import { ai } from '../ai'
import {
  isCloud,
  isPrivateAddress,
  keyNameOf,
  mayAnswer,
  type ChatEntry,
} from '../chain'
import {
  chainStatusStore,
  describeRoute,
  downWord,
  type EntryStatus,
} from '../chainStatus'
import { entryReadiness, type AiReadiness } from '../lib/readiness'
import { localChatStore } from '../local/chatState'
import { entryListKey, loadEntryModels } from '../modelLists'
import { PROVIDERS } from '../providers/meta'
import { normalizeBaseUrl } from '../providers/openai'
import {
  addChatEntry,
  aiSettingsStore,
  entryModel,
  moveChatEntry,
  removeChatEntry,
  updateChatEntry,
} from '../store'
import type { ChatProviderId } from '../types'
import { AddressField, OriginHelp } from './AddressField'
import { KeyField } from './KeyField'
import { ModelPicker } from './ModelField'
import { TestConnection } from './TestConnection'

// The model on this device, and the code that runs it, load only when it's
// chosen: the AI features' shared code shouldn't carry them.
const LocalChatField = lazy(() =>
  import('./LocalChatField').then((module) => ({
    default: module.LocalChatField,
  })),
)

const KINDS: readonly SegmentedOption<ChatProviderId>[] = [
  { value: 'compatible', label: 'Server' },
  { value: 'anthropic', label: 'Anthropic' },
  { value: 'openai', label: 'OpenAI' },
  { value: 'browser', label: 'This device' },
]

const KIND_NAMES: Record<ChatProviderId, string> = {
  compatible: 'OpenAI-compatible server',
  anthropic: 'Anthropic',
  openai: 'OpenAI',
  browser: 'This device',
}

/** Whether each provider is set up, as the client will judge it. */
function useEntryReady() {
  const keys = useStore(savedSecretsStore)
  const localChat = useStore(localChatStore)
  return (entry: ChatEntry) => entryReadiness(entry, keys, localChat)
}

/**
 * Checks chat's providers when Settings opens, and again when an address
 * changes (each check is trusted for a minute, so this is cheap).
 */
function useChainCheck(chain: readonly ChatEntry[]) {
  const addresses = chain
    .map((entry) => `${entry.id}|${entry.provider}|${entry.baseUrl}`)
    .join(',')
  useEffect(() => {
    const controller = new AbortController()
    const timer = setTimeout(
      () => void ai.checkChain({ signal: controller.signal }),
      400,
    )
    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [addresses])
}

/**
 * Settings → AI → Chat: the providers chat uses, in order. Requests go to
 * the first that can answer; a cloud provider below the first is used only
 * if it's allowed as a fallback.
 */
export function ChatChainCard() {
  const { chain } = useStore(aiSettingsStore).chat
  const statuses = useStore(chainStatusStore)
  const ready = useEntryReady()
  const [open, setOpen] = useState<string | null>(
    chain.length === 1 ? chain[0].id : null,
  )
  const [checking, setChecking] = useState(false)
  useChainCheck(chain)
  const route = describeRoute(chain, statuses, (entry) => ready(entry).ready)

  async function checkNow() {
    setChecking(true)
    await ai.checkChain({ fresh: true })
    setChecking(false)
  }

  return (
    <SettingsCard
      title="Chat"
      description="Answers, summaries, flashcards and planning help. Momentum asks the first provider in this list; when it’s off, asleep or busy, the next one answers instead."
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-tint px-4 py-2.5">
          <p
            role="status"
            className="min-w-0 text-sm text-fg-muted"
            aria-label="Where chat goes now"
          >
            <span
              aria-hidden
              className={cn(
                'mr-2 inline-block size-2 rounded-full align-middle',
                !route.using
                  ? 'bg-rose-400'
                  : route.down.length > 0
                    ? 'bg-amber-400'
                    : 'bg-emerald-400',
              )}
            />
            {route.text}
            {route.using && (
              <span className="text-fg-subtle">
                {' '}
                · {entryModel(route.using) || 'no model'}
              </span>
            )}
          </p>
          <button
            type="button"
            onClick={() => void checkNow()}
            disabled={checking}
            className="rounded-full px-3 py-1.5 text-xs font-semibold text-fg-muted transition hover:bg-line disabled:opacity-40"
          >
            {checking ? 'Checking…' : 'Check now'}
          </button>
        </div>
        <ol className="space-y-2" aria-label="Chat providers, in order">
          {chain.map((entry, index) => (
            <EntryCard
              key={entry.id}
              entry={entry}
              index={index}
              count={chain.length}
              status={statuses[entry.id]}
              open={open === entry.id}
              onToggle={() =>
                setOpen((current) => (current === entry.id ? null : entry.id))
              }
            />
          ))}
        </ol>
        <AddEntry onAdded={setOpen} />
      </div>
    </SettingsCard>
  )
}

function StatusText({
  entry,
  status,
  allowed,
}: {
  entry: ChatEntry
  status: EntryStatus | undefined
  allowed: boolean
}) {
  const ready = useEntryReady()(entry)
  let text: string
  let tone: 'up' | 'down' | 'idle' = 'idle'
  if (!allowed) text = 'Not a fallback'
  else if (!ready.ready)
    text =
      ready.reason === 'no-key'
        ? 'Needs a key'
        : ready.reason === 'no-address'
          ? 'Needs an address'
          : ready.reason === 'not-downloaded'
            ? 'Not downloaded'
            : 'Needs a model'
  else if (PROVIDERS[entry.provider].local) text = 'On this device'
  else if (status?.state === 'checking') text = 'Checking…'
  else if (status?.state === 'up') {
    text = 'Online'
    tone = 'up'
  } else if (status?.state === 'down') {
    text = downWord(status)
    text = text[0].toUpperCase() + text.slice(1)
    tone = 'down'
  } else text = 'Not checked'
  return (
    <span className="inline-flex shrink-0 items-center gap-1.5 text-xs whitespace-nowrap text-fg-subtle">
      <span
        aria-hidden
        className={cn(
          'size-2 rounded-full',
          tone === 'up'
            ? 'bg-emerald-400'
            : tone === 'down'
              ? 'bg-rose-400'
              : 'bg-fg-subtle/50',
        )}
      />
      {text}
    </span>
  )
}

function EntryCard({
  entry,
  index,
  count,
  status,
  open,
  onToggle,
}: {
  entry: ChatEntry
  index: number
  count: number
  status: EntryStatus | undefined
  open: boolean
  onToggle: () => void
}) {
  const panel = useId()
  const allowed = mayAnswer(entry, index)
  const model = entryModel(entry)
  return (
    <li className="rounded-2xl bg-tint/60 ring-1 ring-line">
      <div className="flex items-center gap-2 py-2 pr-2 pl-3">
        <span
          aria-hidden
          className="flex size-6 shrink-0 items-center justify-center rounded-full bg-line text-xs font-semibold tabular-nums"
        >
          {index + 1}
        </span>
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          aria-controls={panel}
          className="min-w-0 flex-1 py-1 text-left"
        >
          <span className="block truncate text-sm font-medium">
            {entry.name}
          </span>
          <span className="block truncate font-mono text-[11px] text-fg-subtle">
            {model || 'no model chosen'}
          </span>
        </button>
        <StatusText entry={entry} status={status} allowed={allowed} />
        <div className="flex shrink-0 items-center">
          <button
            type="button"
            aria-label={`Move ${entry.name} up`}
            disabled={index === 0}
            onClick={() => moveChatEntry(entry.id, -1)}
            className="flex size-8 items-center justify-center rounded-full text-fg-muted transition hover:bg-line disabled:opacity-30"
          >
            <ChevronUpIcon />
          </button>
          <button
            type="button"
            aria-label={`Move ${entry.name} down`}
            disabled={index === count - 1}
            onClick={() => moveChatEntry(entry.id, 1)}
            className="flex size-8 items-center justify-center rounded-full text-fg-muted transition hover:bg-line disabled:opacity-30"
          >
            <ChevronDownIcon />
          </button>
        </div>
      </div>
      {open && (
        <div
          id={panel}
          className="space-y-4 border-t border-line px-4 pt-4 pb-4"
        >
          <EntryFields entry={entry} index={index} status={status} />
          {count > 1 && (
            <button
              type="button"
              onClick={() => {
                // Its own key goes with it (one shared with others stays).
                const key = keyNameOf(entry)
                if (key?.startsWith('chat:')) void deleteSecret(key)
                removeChatEntry(entry.id)
              }}
              className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold text-rose-300 transition hover:bg-line light:text-rose-600"
            >
              <TrashIcon /> Remove from the list
            </button>
          )}
        </div>
      )}
    </li>
  )
}

function EntryFields({
  entry,
  index,
  status,
}: {
  entry: ChatEntry
  index: number
  status: EntryStatus | undefined
}) {
  const nameId = useId()
  const keys = useStore(savedSecretsStore)
  const ready = useEntryReady()(entry)
  const [name, setName] = useState<string | null>(null)
  const meta = PROVIDERS[entry.provider]
  const keyName = keyNameOf(entry)
  const model = entryModel(entry)
  const cloud = isCloud(entry)
  const canList =
    entry.provider === 'compatible'
      ? Boolean(entry.baseUrl.trim())
      : !meta.needsKey || Boolean(keyName && keys.has(keyName))
  const readiness: AiReadiness = ready.ready
    ? { ready: true, provider: entry.provider, model }
    : { ready: false, provider: entry.provider, reason: ready.reason }

  return (
    <>
      <div>
        <label htmlFor={nameId} className="block text-xs text-fg-muted">
          Name
        </label>
        <input
          id={nameId}
          value={name ?? entry.name}
          onChange={(event) => setName(event.target.value)}
          onBlur={() => {
            if (name !== null && name.trim())
              updateChatEntry(entry.id, { name: name.trim() })
            setName(null)
          }}
          onKeyDown={(event) =>
            event.key === 'Enter' && event.currentTarget.blur()
          }
          placeholder="Home PC"
          className="mt-1 w-full rounded-2xl bg-tint px-4 py-2.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-orange-300/60"
        />
      </div>
      <SegmentedControl
        label={`What ${entry.name} is`}
        value={entry.provider}
        options={KINDS}
        onChange={(provider) =>
          updateChatEntry(entry.id, {
            provider,
            model: '',
            ...(entry.name === KIND_NAMES[entry.provider] ||
            entry.name === PROVIDERS[entry.provider].label
              ? { name: KIND_NAMES[provider] }
              : {}),
          })
        }
        compact
        wrap
      />
      {entry.provider === 'compatible' && (
        <div>
          <AddressField
            value={entry.baseUrl}
            onSave={(baseUrl) => updateChatEntry(entry.id, { baseUrl })}
          />
          <p className="mt-1.5 text-xs text-fg-subtle">
            Ollama, LM Studio, vLLM, OpenRouter, or anything else that speaks
            OpenAI’s API. Another computer works too, at its Tailscale address
            (https://….ts.net).
          </p>
          <p className="mt-3 mb-1 text-xs text-fg-muted">
            Key (if the server needs one)
          </p>
          <KeyField
            provider="compatible"
            name={keyName}
            label={entry.name}
            onChange={() => void loadEntryModels(entry)}
          />
          {(!entry.baseUrl.trim() ||
            isPrivateAddress(normalizeBaseUrl(entry.baseUrl))) && (
            <OriginHelp />
          )}
        </div>
      )}
      {(entry.provider === 'anthropic' || entry.provider === 'openai') && (
        <p
          className={cn(
            'flex items-start gap-1.5 text-xs leading-relaxed',
            keyName && keys.has(keyName)
              ? 'text-fg-subtle'
              : 'text-amber-200 light:text-amber-700',
          )}
        >
          {!(keyName && keys.has(keyName)) && (
            <AlertIcon className="mt-px shrink-0" />
          )}
          {keyName && keys.has(keyName)
            ? `Uses your ${meta.label} key, from Providers above.`
            : `Add your ${meta.label} key in Providers above first.`}
        </p>
      )}
      {entry.provider === 'browser' ? (
        <Suspense
          fallback={<p className="text-xs text-fg-subtle">Checking…</p>}
        >
          <LocalChatField
            modelId={model}
            onChoose={(chosen) => updateChatEntry(entry.id, { model: chosen })}
          />
        </Suspense>
      ) : (
        <ModelPicker
          task="chat"
          listKey={entryListKey(entry)}
          model={entry.model}
          label={entry.name}
          canList={canList}
          missing={
            entry.provider === 'compatible'
              ? 'Add the server’s address above to load its models, or type a name.'
              : `Add your ${meta.label} key above to load its models, or type a name.`
          }
          known={status?.models}
          onChange={(next) => updateChatEntry(entry.id, { model: next })}
          onLoad={() => void loadEntryModels(entry)}
        />
      )}
      {cloud && index > 0 && (
        <div className="flex items-start justify-between gap-4 rounded-2xl bg-tint px-4 py-3">
          <div className="min-w-0">
            <p className="text-sm">Allow as fallback</p>
            <p className="mt-0.5 text-xs leading-relaxed text-fg-subtle">
              When the providers above can’t answer, what you send goes to{' '}
              {entry.name} instead: your question, and the text of any notes,
              documents or photos that go with it. While this is off,{' '}
              {entry.name} is never asked unless you move it to the top.
            </p>
          </div>
          <Switch
            checked={entry.fallback}
            onChange={(fallback) => updateChatEntry(entry.id, { fallback })}
            label={`Allow ${entry.name} as a fallback`}
          />
        </div>
      )}
      {!cloud && index > 0 && (
        <p className="text-xs leading-relaxed text-fg-subtle">
          {entry.provider === 'browser'
            ? 'Runs here, so it’s used whenever the providers above can’t answer: nothing leaves this device.'
            : `On your own network, so it’s used whenever the providers above can’t answer.`}
        </p>
      )}
      {status?.state === 'down' && status.message && (
        <p className="flex items-start gap-1.5 text-xs leading-relaxed text-rose-300 light:text-rose-600">
          <AlertIcon className="mt-px shrink-0" />
          {status.message}
        </p>
      )}
      <TestConnection task="chat" readiness={readiness} entry={entry} />
    </>
  )
}

function AddEntry({ onAdded }: { onAdded: (id: string) => void }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs text-fg-subtle">Add:</span>
      {KINDS.map((kind) => (
        <button
          key={kind.value}
          type="button"
          onClick={() => onAdded(addChatEntry(kind.value))}
          className="inline-flex items-center gap-1 rounded-full bg-tint px-3 py-1.5 text-xs font-semibold transition hover:bg-line"
        >
          <PlusIcon /> {KIND_NAMES[kind.value]}
        </button>
      ))}
    </div>
  )
}
