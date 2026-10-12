import { lazy, Suspense, useId, useState, type ReactNode } from 'react'
import { GlassCard } from '@/components/GlassCard'
import { AlertIcon, ExternalIcon, SparkleIcon } from '@/components/icons'
import {
  SegmentedControl,
  type SegmentedOption,
} from '@/components/SegmentedControl'
import { SettingsCard } from '@/components/SettingsCard'
import { useStore } from '@/lib/store'
import { useAiReadiness } from '../hooks/useAiReadiness'
import { blockedBeforeSending, currentPage } from '../lib/reach'
import type { AiReadiness } from '../lib/readiness'
import { refreshModelsAfterKeyChange } from '../modelLists'
import { PROVIDERS } from '../providers/meta'
import { normalizeBaseUrl } from '../providers/openai'
import {
  aiSettingsStore,
  selection,
  setCompatibleBaseUrl,
  setTaskProvider,
} from '../store'
import type {
  AiTask,
  ChatProviderId,
  EmbeddingProviderId,
  TranscriptionProviderId,
} from '../types'
import { KeyField } from './KeyField'
import { LocalModelField } from './LocalModelField'
import { ModelField } from './ModelField'
import { RepliesCard } from './RepliesCard'
import { TestConnection } from './TestConnection'
import { UsageCard } from './UsageCard'

// The model on this device, and the code that runs it, load only when it's
// chosen: the AI features' shared code shouldn't carry them.
const LocalChatField = lazy(() =>
  import('./LocalChatField').then((module) => ({
    default: module.LocalChatField,
  })),
)

/**
 * Settings → AI: providers and keys, the model for each task, and usage.
 * Features built on embeddings can add a card after the embeddings one.
 */
export function AiSettingsPanel({
  afterEmbeddings,
}: {
  afterEmbeddings?: ReactNode
}) {
  return (
    <>
      <StatusCard />
      <KeysCard />
      <TaskCard task="chat" />
      <RepliesCard />
      <TaskCard task="embeddings" />
      {afterEmbeddings}
      <TaskCard task="transcription" />
      <UsageCard />
    </>
  )
}

function describeReadiness(readiness: AiReadiness): string {
  if (!readiness.ready) return 'not set up'
  return `${PROVIDERS[readiness.provider].label} · ${readiness.model}`
}

function StatusCard() {
  const chat = useAiReadiness('chat')
  const embeddings = useAiReadiness('embeddings')
  const transcription = useAiReadiness('transcription')
  const on = chat.ready || embeddings.ready || transcription.ready
  return (
    <GlassCard className="p-5 sm:p-6">
      <div className="flex items-start gap-4">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-linear-to-br from-amber-300/25 to-orange-500/25 text-xl text-orange-300 ring-1 ring-orange-300/30 light:text-orange-500">
          <SparkleIcon />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-semibold tracking-tight">
            {on ? 'AI is set up' : 'AI is optional'}
          </h2>
          {on ? (
            <dl className="mt-1.5 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
              <dt className="text-fg-subtle">Chat</dt>
              <dd className="min-w-0 truncate text-fg-muted">
                {describeReadiness(chat)}
              </dd>
              <dt className="text-fg-subtle">Embeddings</dt>
              <dd className="min-w-0 truncate text-fg-muted">
                {describeReadiness(embeddings)}
              </dd>
              <dt className="text-fg-subtle">Transcription</dt>
              <dd className="min-w-0 truncate text-fg-muted">
                {describeReadiness(transcription)}
              </dd>
            </dl>
          ) : (
            <p className="mt-1 text-sm text-fg-muted">
              Momentum works fully without it. To use AI features, add your own
              key from Anthropic or OpenAI, or connect a server such as Ollama.
            </p>
          )}
        </div>
      </div>
      <ul className="mt-4 space-y-1.5 text-xs leading-relaxed text-fg-subtle">
        <li>
          Keys stay on this device. They're never logged, and go into a backup
          only if you ask.
        </li>
        <li>
          Requests go straight from this browser to the provider you choose.
          Nothing is sent until you use an AI feature, and each feature shows
          what it will send.
        </li>
      </ul>
    </GlassCard>
  )
}

function KeysCard() {
  return (
    <SettingsCard
      title="Providers"
      description="Bring your own key. Each key is only ever sent to its own provider."
    >
      <div className="space-y-5">
        <HostedProvider provider="anthropic" />
        <HostedProvider provider="openai" />
        <CompatibleProvider />
      </div>
    </SettingsCard>
  )
}

function HostedProvider({ provider }: { provider: 'anthropic' | 'openai' }) {
  const meta = PROVIDERS[provider]
  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <p className="text-sm font-medium">{meta.label}</p>
        {meta.keysUrl && (
          <a
            href={meta.keysUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-xs text-fg-subtle transition hover:text-fg"
          >
            Get a key <ExternalIcon />
          </a>
        )}
      </div>
      <KeyField
        provider={provider}
        onChange={() => void refreshModelsAfterKeyChange(provider)}
      />
    </div>
  )
}

function CompatibleProvider() {
  const { compatibleBaseUrl } = useStore(aiSettingsStore)
  // What's being typed; saved when the field loses focus.
  const [draft, setDraft] = useState<string | null>(null)
  const value = draft ?? compatibleBaseUrl
  const inputId = useId()
  const effective = normalizeBaseUrl(value)
  const page = currentPage()
  const origin = page?.origin ?? ''
  // Said before anything is sent: the browser would refuse it.
  const blocked = page && value.trim() && blockedBeforeSending(page, effective)

  return (
    <div>
      <p className="text-sm font-medium">OpenAI-compatible server</p>
      <p className="mt-0.5 text-xs text-fg-subtle">
        Ollama, LM Studio, vLLM, OpenRouter, or anything else that speaks
        OpenAI's API.
      </p>
      <label htmlFor={inputId} className="mt-3 block text-xs text-fg-muted">
        Address
      </label>
      <div className="mt-1 flex items-center rounded-2xl bg-tint px-4 py-1.5 ring-orange-300/60 focus-within:ring-2">
        <input
          id={inputId}
          type="url"
          inputMode="url"
          value={value}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={() => {
            setCompatibleBaseUrl(value.trim())
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
      <p className="mt-3 mb-1 text-xs text-fg-muted">
        Key (if the server needs one)
      </p>
      <KeyField
        provider="compatible"
        onChange={() => void refreshModelsAfterKeyChange('compatible')}
      />
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
    </div>
  )
}

const CHAT_PROVIDERS: readonly SegmentedOption<ChatProviderId>[] = [
  { value: 'anthropic', label: 'Anthropic' },
  { value: 'openai', label: 'OpenAI' },
  { value: 'compatible', label: 'Compatible' },
  { value: 'browser', label: 'This device' },
]

const EMBEDDING_PROVIDERS: readonly SegmentedOption<EmbeddingProviderId>[] = [
  { value: 'openai', label: 'OpenAI' },
  { value: 'compatible', label: 'Compatible' },
  { value: 'browser', label: 'This device' },
]

const TRANSCRIPTION_PROVIDERS: readonly SegmentedOption<TranscriptionProviderId>[] =
  [
    { value: 'openai', label: 'OpenAI' },
    { value: 'compatible', label: 'Compatible' },
  ]

const TASK_COPY: Record<AiTask, { title: string; description: string }> = {
  chat: {
    title: 'Chat',
    description:
      'Answers, summaries, flashcards and planning help: from a provider, or a model that runs on this device.',
  },
  embeddings: {
    title: 'Embeddings',
    description:
      "Search by meaning across notes and documents. Anthropic doesn't offer embeddings, so they come from OpenAI, a compatible server, or a small model that runs on this device.",
  },
  transcription: {
    title: 'Transcription',
    description:
      "Voice notes: speech into text. Anthropic doesn't offer it, so it comes from OpenAI (Whisper or a GPT transcribe model) or a compatible server.",
  },
}

function TaskCard({ task }: { task: AiTask }) {
  const settings = useStore(aiSettingsStore)
  const readiness = useAiReadiness(task)
  const { provider, model } = selection(settings, task)
  const copy = TASK_COPY[task]
  return (
    <SettingsCard title={copy.title} description={copy.description}>
      <div className="space-y-4">
        {task === 'chat' ? (
          <SegmentedControl
            label="Chat provider"
            value={provider as ChatProviderId}
            options={CHAT_PROVIDERS}
            onChange={(next) => setTaskProvider('chat', next)}
            compact
            wrap
          />
        ) : task === 'embeddings' ? (
          <SegmentedControl
            label="Embeddings provider"
            value={provider as EmbeddingProviderId}
            options={EMBEDDING_PROVIDERS}
            onChange={(next) => setTaskProvider('embeddings', next)}
          />
        ) : (
          <SegmentedControl
            label="Transcription provider"
            value={provider as TranscriptionProviderId}
            options={TRANSCRIPTION_PROVIDERS}
            onChange={(next) => setTaskProvider('transcription', next)}
          />
        )}
        {provider === 'browser' && task === 'chat' ? (
          <Suspense
            fallback={<p className="text-xs text-fg-subtle">Checking…</p>}
          >
            <LocalChatField modelId={model} />
          </Suspense>
        ) : provider === 'browser' ? (
          <LocalModelField modelId={model} />
        ) : (
          <ModelField task={task} provider={provider} model={model} />
        )}
        <TestConnection task={task} readiness={readiness} />
      </div>
    </SettingsCard>
  )
}
