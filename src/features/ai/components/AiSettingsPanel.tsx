import type { ReactNode } from 'react'
import { GlassCard } from '@/components/GlassCard'
import { ExternalIcon, SparkleIcon } from '@/components/icons'
import {
  SegmentedControl,
  type SegmentedOption,
} from '@/components/SegmentedControl'
import { SettingsCard } from '@/components/SettingsCard'
import { useStore } from '@/lib/store'
import { useAiReadiness } from '../hooks/useAiReadiness'
import type { AiReadiness } from '../lib/readiness'
import { refreshModelsAfterKeyChange } from '../modelLists'
import { formatSource, isPrivateAddress } from '../chain'
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
  EmbeddingProviderId,
  TranscriptionProviderId,
} from '../types'
import { AddressField, OriginHelp } from './AddressField'
import { ChatChainCard } from './ChatChainCard'
import { KeyField } from './KeyField'
import { LocalModelField } from './LocalModelField'
import { ModelField } from './ModelField'
import { RepliesCard } from './RepliesCard'
import { TestConnection } from './TestConnection'
import { UsageCard } from './UsageCard'

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
      <ChatChainCard />
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
  return formatSource({
    name: readiness.entry?.name ?? PROVIDERS[readiness.provider].label,
    model: readiness.model,
  })
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
  return (
    <div>
      <p className="text-sm font-medium">OpenAI-compatible server</p>
      <p className="mt-0.5 text-xs text-fg-subtle">
        For embeddings and voice notes: Ollama, LM Studio, vLLM, or anything
        else that speaks OpenAI's API. Chat’s servers are set up in Chat below,
        each with its own address.
      </p>
      <div className="mt-3">
        <AddressField value={compatibleBaseUrl} onSave={setCompatibleBaseUrl} />
      </div>
      <p className="mt-3 mb-1 text-xs text-fg-muted">
        Key (if the server needs one)
      </p>
      <KeyField
        provider="compatible"
        onChange={() => void refreshModelsAfterKeyChange('compatible')}
      />
      <OriginHelp />
    </div>
  )
}

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

const TASK_COPY: Record<
  Exclude<AiTask, 'chat'>,
  { title: string; description: string }
> = {
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

function TaskCard({ task }: { task: Exclude<AiTask, 'chat'> }) {
  const settings = useStore(aiSettingsStore)
  const readiness = useAiReadiness(task)
  const { provider, model } = selection(settings, task)
  const copy = TASK_COPY[task]
  return (
    <SettingsCard title={copy.title} description={copy.description}>
      <div className="space-y-4">
        {task === 'embeddings' ? (
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
        {task === 'embeddings' && provider !== 'browser' && <HomeMachineTip />}
        {provider === 'browser' ? (
          <LocalModelField modelId={model} />
        ) : (
          <ModelField task={task} provider={provider} model={model} />
        )}
        <TestConnection task={task} readiness={readiness} />
      </div>
    </SettingsCard>
  )
}

/**
 * Chat on a computer at home that's often off is fine (it falls back), but
 * embeddings never switch on their own: an index has to come from one
 * model. So the small model on this device is suggested for them.
 */
function HomeMachineTip() {
  const { chat } = useStore(aiSettingsStore)
  const home = chat.chain.find(
    (entry) =>
      entry.provider === 'compatible' &&
      entry.baseUrl.trim() &&
      isPrivateAddress(normalizeBaseUrl(entry.baseUrl)),
  )
  if (!home) return null
  return (
    <div className="rounded-2xl bg-tint px-4 py-3 text-xs leading-relaxed text-fg-muted">
      <p>
        Chat runs on {home.name}, which can be off or asleep. Chat falls back to
        the next provider then, but embeddings never switch on their own (search
        needs every passage from the same model), so they’d wait until it’s
        back. The small model on this device is always here: it’s the dependable
        choice.
      </p>
      <button
        type="button"
        onClick={() => setTaskProvider('embeddings', 'browser')}
        className="mt-2 rounded-full bg-tint px-3 py-1.5 font-semibold transition hover:bg-line"
      >
        Use the model on this device
      </button>
    </div>
  )
}
