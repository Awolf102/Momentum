import { describe, expect, it, vi } from 'vitest'
import { createAiClient, EMBED_BATCH, type AiClientDeps } from './client'
import { AiError } from './errors'
import { createMockProvider, type MockProviderOptions } from './providers/mock'
import { DEFAULT_AI_SETTINGS, type AiSettings } from './store'
import type { ProviderId } from './types'

function setup(
  options: {
    settings?: Partial<AiSettings>
    keys?: Partial<Record<ProviderId, string>>
    mock?: MockProviderOptions
  } = {},
) {
  const settings: AiSettings = {
    ...DEFAULT_AI_SETTINGS,
    chat: { provider: 'anthropic', models: { anthropic: 'claude-test' } },
    embeddings: { provider: 'openai', models: { openai: 'embed-test' } },
    ...options.settings,
  }
  const keys = options.keys ?? { anthropic: 'sk-ant-test', openai: 'sk-test' }
  const provider = createMockProvider(options.mock)
  const recordUsage = vi.fn()
  const createProvider = vi.fn(() => provider)
  const deps: AiClientDeps = {
    getSettings: () => settings,
    getKey: async (id) => keys[id],
    createProvider,
    recordUsage,
    retry: { sleep: async () => {}, random: () => 0.5 },
  }
  return { client: createAiClient(deps), provider, recordUsage, createProvider }
}

describe('AI client', () => {
  it('streams a reply from the chosen provider and counts the tokens', async () => {
    const { client, provider, recordUsage, createProvider } = setup({
      mock: {
        replies: [
          {
            chunks: ['Hello', ' there'],
            usage: { inputTokens: 20, outputTokens: 4 },
          },
        ],
      },
    })
    const text: string[] = []
    for await (const event of client.chat({
      messages: [{ role: 'user', content: 'Hi' }],
      system: 'Be kind.',
    })) {
      if (event.type === 'text') text.push(event.text)
    }
    expect(text.join('')).toBe('Hello there')
    expect(createProvider).toHaveBeenCalledWith({
      provider: 'anthropic',
      apiKey: 'sk-ant-test',
    })
    expect(provider.calls[0]).toMatchObject({
      model: 'claude-test',
      system: 'Be kind.',
    })
    expect(recordUsage).toHaveBeenCalledWith('anthropic', 'claude-test', {
      inputTokens: 20,
      outputTokens: 4,
    })
  })

  it('asks for a key when the provider needs one', async () => {
    const { client } = setup({ keys: {} })
    await expect(client.complete({ messages: [] })).rejects.toMatchObject({
      kind: 'no-key',
    })
  })

  it('asks for a model when none is chosen', async () => {
    const { client } = setup({
      settings: { chat: { provider: 'anthropic', models: {} } },
    })
    await expect(client.complete({ messages: [] })).rejects.toMatchObject({
      kind: 'no-model',
    })
  })

  it('reaches a compatible server without a key', async () => {
    const { client, createProvider } = setup({
      keys: {},
      settings: {
        chat: { provider: 'compatible', models: { compatible: 'llama-test' } },
        compatibleBaseUrl: 'http://localhost:11434/v1',
      },
    })
    const { text } = await client.complete({
      messages: [{ role: 'user', content: 'Hi' }],
    })
    expect(text).toBe('Mock reply to: Hi')
    expect(createProvider).toHaveBeenCalledWith({
      provider: 'compatible',
      apiKey: undefined,
      baseUrl: 'http://localhost:11434/v1',
    })
  })

  it('retries a busy provider and tells the caller', async () => {
    const onRetry = vi.fn()
    const { client, provider } = setup({
      mock: {
        replies: [
          { error: new AiError('overloaded', 'Overloaded') },
          { chunks: ['Done'] },
        ],
      },
    })
    const result = await client.complete({
      messages: [{ role: 'user', content: 'Hi' }],
      onRetry,
    })
    expect(result).toMatchObject({ text: 'Done', stopReason: 'end' })
    expect(provider.calls).toHaveLength(2)
    expect(onRetry).toHaveBeenCalledWith(
      expect.objectContaining({ attempt: 1 }),
    )
  })

  it('passes on a failure part-way through a reply, still counting what was used', async () => {
    const { client, provider, recordUsage } = setup({
      mock: {
        replies: [
          {
            chunks: ['Half', ' a reply'],
            failAfter: 1,
            error: new AiError('overloaded', 'Overloaded'),
            usage: { inputTokens: 30, outputTokens: 10 },
          },
        ],
      },
    })
    await expect(
      client.complete({ messages: [{ role: 'user', content: 'Hi' }] }),
    ).rejects.toMatchObject({
      kind: 'overloaded',
    })
    expect(provider.calls).toHaveLength(1)
    expect(recordUsage).toHaveBeenCalledWith('anthropic', 'claude-test', {
      inputTokens: 30,
      outputTokens: 0,
    })
  })

  it('stops when cancelled', async () => {
    const controller = new AbortController()
    const { client } = setup({
      mock: { replies: [{ chunks: ['a', 'b', 'c'] }] },
    })
    const seen: string[] = []
    await expect(
      (async () => {
        for await (const event of client.chat({
          messages: [{ role: 'user', content: 'Hi' }],
          signal: controller.signal,
        })) {
          if (event.type !== 'text') continue
          seen.push(event.text)
          controller.abort()
        }
      })(),
    ).rejects.toMatchObject({ kind: 'aborted' })
    expect(seen).toEqual(['a'])
  })

  it('embeds in batches and counts each batch', async () => {
    const { client, provider, recordUsage } = setup()
    const texts = Array.from(
      { length: EMBED_BATCH * 2 + 3 },
      (_, index) => `text ${index}`,
    )
    const vectors = await client.embed(texts)
    expect(vectors).toHaveLength(texts.length)
    expect(provider.embedCalls.map((call) => call.input.length)).toEqual([
      EMBED_BATCH,
      EMBED_BATCH,
      3,
    ])
    expect(recordUsage).toHaveBeenCalledTimes(3)
    expect(await client.embed([])).toEqual([])
  })

  it('tests a connection without throwing', async () => {
    const ok = await setup({
      mock: { replies: [{ chunks: ['Ready'] }] },
    }).client.testConnection('chat')
    expect(ok).toMatchObject({
      ok: true,
      provider: 'anthropic',
      model: 'claude-test',
      reply: 'Ready',
    })

    const embeddings = await setup().client.testConnection('embeddings')
    expect(embeddings).toMatchObject({ ok: true, dimensions: 8 })

    const failing = setup({
      mock: { replies: [{ error: new AiError('auth', 'invalid x-api-key') }] },
    })
    const result = await failing.client.testConnection('chat')
    expect(result).toMatchObject({ ok: false })
    expect(result.error?.kind).toBe('auth')
    // A test is one honest try, not a retry loop.
    expect(failing.provider.calls).toHaveLength(1)
  })

  it('lists a provider’s models', async () => {
    const { client } = setup({
      mock: { models: [{ id: 'one' }, { id: 'two' }] },
    })
    expect(await client.listModels('openai')).toEqual([
      { id: 'one' },
      { id: 'two' },
    ])
  })
})
