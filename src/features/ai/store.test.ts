import { describe, expect, it } from 'vitest'
import { aiReadiness } from './lib/readiness'
import {
  DEFAULT_AI_SETTINGS,
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
    })
    expect(parseAiSettings('nope')).toBeNull()
    // Settings saved before voice notes have no transcription yet.
    expect(parseAiSettings({})?.transcription).toEqual(
      DEFAULT_AI_SETTINGS.transcription,
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
