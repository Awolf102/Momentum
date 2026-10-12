import { SegmentedControl } from '@/components/SegmentedControl'
import { SettingsCard } from '@/components/SettingsCard'
import { Switch } from '@/components/Switch'
import { useStore } from '@/lib/store'
import {
  aiSettingsStore,
  CHAT_FEATURES,
  REPLY_LIMITS,
  setMaxReplyTokens,
  setThinking,
} from '../store'
import type { ChatFeature } from '../types'

const FEATURES: Record<ChatFeature, { title: string; detail: string }> = {
  ask: {
    title: 'Ask',
    detail: 'Answers about your notes, documents and plans',
  },
  cards: { title: 'Flashcards', detail: 'Suggesting cards from a note or PDF' },
  quizzes: {
    title: 'Quizzes',
    detail: 'Writing questions, and marking short answers',
  },
  summaries: {
    title: 'Summaries',
    detail: 'The weekly write-up, and tidying voice notes',
  },
  planning: { title: 'Plan my day', detail: 'Drafting a day’s plan' },
  photos: {
    title: 'Notes from photos',
    detail: 'Writing out handwriting and slides',
  },
}

/** "8K": a whole number of thousands, as the choices are. */
const short = (tokens: number) => `${Math.round(tokens / 1024)}K`

/** Settings → AI: whether models think before answering, and the longest reply. */
export function RepliesCard() {
  const { thinking, maxReplyTokens } = useStore(aiSettingsStore)
  // A limit saved before the choices changed still shows as chosen.
  const limits: readonly number[] = REPLY_LIMITS.includes(
    maxReplyTokens as (typeof REPLY_LIMITS)[number],
  )
    ? REPLY_LIMITS
    : [...REPLY_LIMITS, maxReplyTokens].sort((a, b) => a - b)
  return (
    <SettingsCard
      title="Replies"
      description="How chat models answer, whichever provider you use."
    >
      <div className="space-y-6">
        <div>
          <p className="text-sm font-medium">Think before answering</p>
          <p className="mt-0.5 text-xs leading-relaxed text-fg-subtle">
            Small models on your own computer (Qwen on Ollama, say) think before
            they answer, which can take a minute or more. Off, they answer
            straight away. This is sent to OpenAI-compatible servers such as
            Ollama and OpenRouter; Anthropic’s and OpenAI’s models don’t think
            unless asked, so they aren’t affected.
          </p>
          <ul className="mt-3 divide-y divide-line">
            {CHAT_FEATURES.map((feature) => (
              <li
                key={feature}
                className="flex items-center justify-between gap-4 py-2.5"
              >
                <div className="min-w-0">
                  <p className="text-sm">{FEATURES[feature].title}</p>
                  <p className="text-xs text-fg-subtle">
                    {FEATURES[feature].detail}
                  </p>
                </div>
                <Switch
                  checked={thinking[feature]}
                  onChange={(on) => setThinking(feature, on)}
                  label={`Think before answering: ${FEATURES[feature].title}`}
                />
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="text-sm font-medium">Longest reply</p>
          <p className="mt-0.5 mb-3 text-xs leading-relaxed text-fg-subtle">
            Every request stops here, so no reply can run on for ever. A reply
            that reaches it is kept, and says it was cut off. In tokens:{' '}
            {short(maxReplyTokens)} is about{' '}
            {(Math.round((maxReplyTokens * 0.75) / 500) * 500).toLocaleString()}{' '}
            words, and thinking counts towards it.
          </p>
          <SegmentedControl
            label="Longest reply, in tokens"
            value={String(maxReplyTokens)}
            options={limits.map((tokens) => ({
              value: String(tokens),
              label: short(tokens),
            }))}
            onChange={(value) => setMaxReplyTokens(Number(value))}
            compact
          />
        </div>
      </div>
    </SettingsCard>
  )
}
