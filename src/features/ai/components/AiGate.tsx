import type { ReactNode } from 'react'
import { Link } from 'wouter'
import { GlassCard } from '@/components/GlassCard'
import { SparkleIcon } from '@/components/icons'
import { paths } from '@/lib/routes'
import { useAiReadiness } from '../hooks/useAiReadiness'
import { PROVIDERS } from '../providers/meta'
import type { AiTask } from '../types'

interface AiGateProps {
  task: AiTask
  /** What the feature is called, e.g. "Chat with your documents". */
  feature: string
  children: ReactNode
}

/**
 * Shows an AI feature once it's set up, and a friendly way to set it up
 * until then. Every AI feature sits behind one of these.
 */
export function AiGate({ task, feature, children }: AiGateProps) {
  const readiness = useAiReadiness(task)
  if (readiness.ready) return children

  const label = PROVIDERS[readiness.provider].label
  const reason = {
    'no-key': `Add an API key in Settings to turn it on. You can use Anthropic, OpenAI or a compatible server such as Ollama.`,
    'no-model': `Choose a ${label} model in Settings to turn it on.`,
    'no-address': 'Add your server’s address in Settings to turn it on.',
    'not-downloaded':
      'Download the model that runs on this device, in Settings, to turn it on.',
  }[readiness.reason]

  return (
    <GlassCard className="flex flex-col items-center px-6 py-10 text-center">
      <span className="flex size-12 items-center justify-center rounded-2xl bg-linear-to-br from-amber-300/25 to-orange-500/25 text-2xl text-orange-300 ring-1 ring-orange-300/30 light:text-orange-500">
        <SparkleIcon />
      </span>
      <h2 className="mt-4 text-lg font-semibold tracking-tight">
        {feature} uses AI
      </h2>
      <p className="mt-1.5 max-w-sm text-sm text-fg-muted">{reason}</p>
      <Link
        href={paths.settings('ai')}
        className="mt-5 rounded-full bg-linear-to-br from-amber-300 to-orange-500 px-5 py-2.5 text-sm font-semibold text-orange-950 transition hover:scale-[1.02] active:scale-95"
      >
        Open AI settings
      </Link>
      <p className="mt-4 text-xs text-fg-subtle">
        Everything else in Momentum works without it.
      </p>
    </GlassCard>
  )
}
