import { useEffect, useRef, useState } from 'react'
import { AlertIcon, CheckIcon } from '@/components/icons'
import { useStore } from '@/lib/store'
import { ai } from '../ai'
import type { ConnectionTest } from '../client'
import { describeAiError } from '../errors'
import { localModelStore, modelStored } from '../local/client'
import { gpuStore } from '../local/webgpu'
import { formatLatency } from '../lib/format'
import { formatSource, type ChatEntry } from '../chain'
import type { AiReadiness } from '../lib/readiness'
import { PROVIDERS } from '../providers/meta'
import type { AiTask } from '../types'
import { ReplyStatus } from './ReplyStatus'

const NOT_READY: Record<
  Exclude<AiReadiness, { ready: true }>['reason'],
  (label: string) => string
> = {
  'no-key': (label) => `Add your ${label} key above first.`,
  'no-model': () => 'Choose a model first.',
  'no-address': () => 'Add the server address above first.',
  'not-downloaded': () => 'Download the model above first.',
}

/**
 * Sends one tiny request with the current settings and reports how it
 * went: for chat, to one provider in its list.
 */
export function TestConnection({
  task,
  readiness,
  entry,
}: {
  task: AiTask
  readiness: AiReadiness
  /** Chat: the provider in its list to test. */
  entry?: ChatEntry
}) {
  const [outcome, setOutcome] = useState<{
    target: string
    result: ConnectionTest
  } | null>(null)
  const [testing, setTesting] = useState(false)
  const [since, setSince] = useState(0)
  const controller = useRef<AbortController | null>(null)
  const meta = PROVIDERS[readiness.provider]
  const label = entry?.name ?? meta.label
  // The model on this device is tested only once it's downloaded (Download
  // says how big it is; a test shouldn't start that by surprise).
  const model = useStore(localModelStore)
  // (Chat on this device: readiness says when it isn't downloaded.)
  const waiting = meta.local && task !== 'chat' && !modelStored(model)
  const gpu = useStore(gpuStore)
  const noGpu = meta.local && task === 'chat' && gpu.status === 'missing'
  const target = readiness.ready
    ? `${readiness.provider}:${readiness.model}:${entry?.baseUrl ?? ''}`
    : ''
  // A result only describes the settings it was run with.
  const result = outcome?.target === target ? outcome.result : null

  useEffect(() => () => controller.current?.abort(), [])

  async function run() {
    controller.current = new AbortController()
    setTesting(true)
    setSince(Date.now())
    setOutcome(null)
    const tested = target
    const next = await ai.testConnection(task, controller.current.signal, {
      entryId: entry?.id,
    })
    setOutcome({ target: tested, result: next })
    setTesting(false)
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={!readiness.ready || testing || waiting || noGpu}
          onClick={() => void run()}
          className="rounded-full glass px-4 py-2 text-sm font-semibold transition hover:scale-[1.02] active:scale-95 disabled:pointer-events-none disabled:opacity-40"
        >
          {testing ? 'Testing…' : 'Test connection'}
        </button>
        {testing && (
          <button
            type="button"
            onClick={() => controller.current?.abort()}
            className="rounded-full px-3 py-2 text-xs font-semibold text-fg-muted transition hover:bg-tint"
          >
            Cancel
          </button>
        )}
      </div>
      {testing && task === 'chat' ? (
        <ReplyStatus since={since} className="text-xs" />
      ) : (
        <p className="text-xs text-fg-subtle" role="status">
          {result ? (
            <ResultLine result={result} task={task} entry={entry} />
          ) : noGpu ? (
            'This browser can’t run a model on this device (see above).'
          ) : readiness.ready && meta.local ? (
            waiting ? (
              'Download the model above first.'
            ) : task === 'chat' ? (
              'Loads the model and has it write a short reply, on this device: nothing is sent.'
            ) : (
              'Embeds one short test phrase on this device.'
            )
          ) : readiness.ready ? (
            task === 'chat' ? (
              `Sends a one-line test message to ${label}.`
            ) : task === 'transcription' ? (
              `Sends a second of silence to ${label}.`
            ) : (
              `Sends one short test phrase to ${label}.`
            )
          ) : (
            NOT_READY[readiness.reason](label)
          )}
        </p>
      )}
    </div>
  )
}

function ResultLine({
  result,
  task,
  entry,
}: {
  result: ConnectionTest
  task: AiTask
  entry?: ChatEntry
}) {
  // Without a provider named, chat's test goes wherever a request would.
  const by = !entry && result.source ? ` (${formatSource(result.source)})` : ''
  if (!result.ok) {
    return (
      <span className="inline-flex items-start gap-1.5 text-rose-300 light:text-rose-600">
        <AlertIcon className="mt-px shrink-0" />
        {describeAiError(result.error)}
      </span>
    )
  }
  if (result.tokensPerSecond !== undefined)
    return (
      <span className="inline-flex items-start gap-1.5 text-fg-muted">
        <CheckIcon className="mt-px shrink-0 text-orange-300 light:text-orange-500" />
        <span>
          Working: the first words came after{' '}
          {formatLatency(result.firstTokenMs ?? 0)} (loading the model
          included), then {result.tokensPerSecond} tokens a second. It replied “
          {result.reply}”.
        </span>
      </span>
    )
  const detail =
    result.dimensions !== undefined
      ? `${result.dimensions}-number vectors`
      : task === 'transcription'
        ? result.reply
          ? `heard “${result.reply}”`
          : 'heard the silence'
        : result.reply
          ? `replied “${result.reply}”`
          : 'replied'
  return (
    <span className="inline-flex items-start gap-1.5 text-fg-muted">
      <CheckIcon className="mt-px shrink-0 text-orange-300 light:text-orange-500" />
      Connected{by}: {detail} in {formatLatency(result.latencyMs ?? 0)}.
    </span>
  )
}
