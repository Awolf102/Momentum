import { describe, expect, it } from 'vitest'
import { aiReadiness } from './lib/readiness'
import { NO_LOCAL_CHAT } from './local/chatState'
import {
  DEFAULT_AI_SETTINGS,
  DEFAULT_MAX_REPLY_TOKENS,
  DEFAULT_THINKING,
  parseAiSettings,
  parseUsage,
  selection,
  type AiSettings,
} from './store'

const withChat = (
  chat: AiSettings['chat'],
  extra: Partial<AiSettings> = {},
): AiSettings => ({
  ...DEFAULT_AI_SETTINGS,
  chat,
  ...extra,
})

describe('AI settings', () => {
  it('keeps the model chosen for each provider', () => {
    const settings = withChat({
      provider: 'openai',
      models: { anthropic: 'claude-x', openai: ' gpt-x ' },
    })
    expect(selection(settings, 'chat')).toEqual({
      provider: 'openai',
      model: 'gpt-x',
    })
    expect(
      selection(
        { ...settings, chat: { ...settings.chat, provider: 'anthropic' } },
        'chat',
      ),
    ).toEqual({
      provider: 'anthropic',
      model: 'claude-x',
    })
  })

  it('repairs damaged settings field by field', () => {
    const parsed = parseAiSettings({
      chat: {
        provider: 'nonsense',
        models: { anthropic: 'claude-x', openai: 42 },
      },
      embeddings: { provider: 'anthropic', models: {} },
      transcription: {
        provider: 'anthropic',
        models: { compatible: 'whisper-local-test' },
      },
      prices: {
        'openai:gpt-x': { input: 1, output: 2 },
        broken: { input: -1, output: 1 },
      },
    })
    expect(parsed).toEqual({
      chat: { provider: 'anthropic', models: { anthropic: 'claude-x' } },
      // Anthropic has no embeddings or transcription, so it can't be chosen for them.
      embeddings: { provider: 'openai', models: {} },
      transcription: {
        provider: 'openai',
        models: { compatible: 'whisper-local-test' },
      },
      compatibleBaseUrl: DEFAULT_AI_SETTINGS.compatibleBaseUrl,
      prices: { 'openai:gpt-x': { input: 1, output: 2 } },
      thinking: DEFAULT_THINKING,
      maxReplyTokens: DEFAULT_MAX_REPLY_TOKENS,
    })
    expect(parseAiSettings('nope')).toBeNull()
    // Settings saved before voice notes have no transcription yet.
    expect(parseAiSettings({})?.transcription).toEqual(
      DEFAULT_AI_SETTINGS.transcription,
    )
  })

  it('keeps thinking off unless it was turned on, and the reply cap in range', () => {
    // Settings saved before thinking control: off everywhere, the default cap.
    expect(parseAiSettings({})).toMatchObject({
      thinking: {
        ask: false,
        cards: false,
        quizzes: false,
        summaries: false,
        planning: false,
        photos: false,
      },
      maxReplyTokens: 8192,
    })
    const parsed = parseAiSettings({
      thinking: { ask: true, cards: 'yes', nonsense: true },
      maxReplyTokens: 4096,
    })
    expect(parsed?.thinking).toEqual({ ...DEFAULT_THINKING, ask: true })
    expect(parsed?.maxReplyTokens).toBe(4096)
    for (const broken of [0, 100, 1e9, 4096.5, '4096', null])
      expect(parseAiSettings({ maxReplyTokens: broken })?.maxReplyTokens).toBe(
        DEFAULT_MAX_REPLY_TOKENS,
      )
  })

  it('drops malformed usage entries', () => {
    expect(
      parseUsage({
        months: {
          '2026-10': {
            'openai:gpt-x': { inputTokens: 1, outputTokens: 2, requests: 1 },
            bad: { inputTokens: 'x' },
          },
          october: {},
        },
      }),
    ).toEqual({
      months: {
        '2026-10': {
          'openai:gpt-x': { inputTokens: 1, outputTokens: 2, requests: 1 },
        },
      },
    })
  })
})

describe('aiReadiness', () => {
  const keys = (...names: string[]) => new Set(names)

  it('needs a key for hosted providers', () => {
    const settings = withChat({
      provider: 'anthropic',
      models: { anthropic: 'claude-x' },
    })
    expect(aiReadiness(settings, keys(), 'chat')).toEqual({
      ready: false,
      provider: 'anthropic',
      reason: 'no-key',
    })
    expect(aiReadiness(settings, keys('anthropic'), 'chat')).toEqual({
      ready: true,
      provider: 'anthropic',
      model: 'claude-x',
    })
  })

  it('needs a model', () => {
    const settings = withChat({ provider: 'openai', models: {} })
    expect(aiReadiness(settings, keys('openai'), 'chat')).toMatchObject({
      ready: false,
      reason: 'no-model',
    })
  })

  it("doesn't need a key for a compatible server, but needs its address", () => {
    const settings = withChat({
      provider: 'compatible',
      models: { compatible: 'llama' },
    })
    expect(aiReadiness(settings, keys(), 'chat')).toMatchObject({ ready: true })
    expect(
      aiReadiness({ ...settings, compatibleBaseUrl: ' ' }, keys(), 'chat'),
    ).toMatchObject({
      ready: false,
      reason: 'no-address',
    })
  })
})

describe('chat on this device', () => {
  it('can be chosen, with the recommended model to begin with', () => {
    const settings = parseAiSettings({
      chat: { provider: 'browser', models: {} },
    })!
    expect(settings.chat.provider).toBe('browser')
    expect(selection(settings, 'chat')).toEqual({
      provider: 'browser',
      model: 'qwen3.5-2b',
    })
    // Embeddings on this device keep their own model.
    expect(
      selection(
        { ...settings, embeddings: { provider: 'browser', models: {} } },
        'embeddings',
      ).model,
    ).toBe('all-MiniLM-L6-v2')
  })

  it('isn’t ready until its model is downloaded, once that’s known', () => {
    const settings = withChat({ provider: 'browser', models: {} })
    const noKeys = new Set<string>()
    // Not looked yet: ready (a request says if it isn't there).
    expect(aiReadiness(settings, noKeys, 'chat').ready).toBe(true)
    const known = (status: 'absent' | 'stored') => ({
      ...NO_LOCAL_CHAT,
      files: {
        'qwen3.5-2b':
          status === 'absent'
            ? { status }
            : { status, complete: true, bytes: 1, weightFraction: 1 },
      },
    })
    expect(aiReadiness(settings, noKeys, 'chat', known('absent'))).toEqual({
      ready: false,
      provider: 'browser',
      reason: 'not-downloaded',
    })
    expect(aiReadiness(settings, noKeys, 'chat', known('stored')).ready).toBe(
      true,
    )
  })
})
