import type OpenAI from 'openai'
import type {
  ChatCompletionChunk,
  ChatCompletionContentPart,
  ChatCompletionCreateParamsStreaming,
  ChatCompletionMessageParam,
} from 'openai/resources/chat/completions'
import { abortError, AiError } from '../errors'
import { textOf } from '../lib/content'
import { normalizeSdkError, type SdkErrorClasses } from '../lib/sdkErrors'
import { createThinkSplitter } from '../lib/thinking'
import type {
  AiProvider,
  ChatEvent,
  ChatMessage,
  ModelInfo,
  StopReason,
  TokenUsage,
} from '../types'

type OpenAiSdk = typeof import('openai')

/**
 * Messages as OpenAI (and compatible servers) take them: pictures as data
 * URLs, read in detail (handwriting needs it).
 */
export function toOpenAiMessages(
  messages: readonly ChatMessage[],
): ChatCompletionMessageParam[] {
  return messages.map(({ role, content }): ChatCompletionMessageParam => {
    if (typeof content === 'string') return { role, content }
    if (role === 'assistant') return { role, content: textOf(content) }
    return {
      role,
      content: content.map((part): ChatCompletionContentPart =>
        part.type === 'text'
          ? { type: 'text', text: part.text }
          : {
              type: 'image_url',
              image_url: {
                url: `data:${part.mediaType};base64,${part.data}`,
                detail: 'high',
              },
            },
      ),
    }
  })
}

function mapFinishReason(
  reason: ChatCompletionChunk.Choice['finish_reason'],
): StopReason {
  switch (reason) {
    case 'stop':
      return 'end'
    case 'length':
      return 'max-tokens'
    case 'content_filter':
      return 'refusal'
    default:
      return 'other'
  }
}

/**
 * Accepts a server address as people tend to type it: a bare origin such as
 * `http://localhost:11434` gets the conventional `/v1` path.
 */
export function normalizeBaseUrl(input: string): string {
  const trimmed = input.trim().replace(/\/+$/, '')
  try {
    const url = new URL(trimmed)
    if (url.pathname === '/' || url.pathname === '') return `${url.origin}/v1`
    return trimmed
  } catch {
    return trimmed
  }
}

/** Whether a server is OpenRouter, which has its own way to switch thinking off. */
export function isOpenRouter(baseUrl: string | undefined): boolean {
  try {
    const { hostname } = new URL(normalizeBaseUrl(baseUrl ?? ''))
    return hostname === 'openrouter.ai' || hostname.endsWith('.openrouter.ai')
  } catch {
    return false
  }
}

/**
 * How a compatible server is asked to answer without thinking first:
 * Ollama's documented `reasoning_effort: "none"` (which other servers that
 * follow OpenAI's reasoning models take too), or OpenRouter's `reasoning`.
 */
export function thinkingOff(
  baseUrl: string | undefined,
): Record<string, unknown> {
  return isOpenRouter(baseUrl)
    ? { reasoning: { effort: 'none' } }
    : { reasoning_effort: 'none' }
}

/**
 * Servers and models that refused the switch (an older server, or a model
 * that always thinks), by `address|model`: it isn't sent to them again
 * until the page is reloaded.
 */
const refusesThinkingSwitch = new Set<string>()

/** Whether a request was turned away because of the thinking switch. */
function refusedSwitch(error: unknown, sdk: SdkErrorClasses): boolean {
  if (!(error instanceof sdk.APIError)) return false
  const { status, message } = error as Error & { status?: number }
  return (status === 400 || status === 422) && /reasoning|think/i.test(message)
}

/**
 * OpenAI, or any server that speaks its API (Ollama, LM Studio, vLLM,
 * OpenRouter…). Uses the official `openai` SDK, loaded on first use.
 */
export function createOpenAiProvider(options: {
  id: 'openai' | 'compatible'
  apiKey?: string
  baseUrl?: string
  loadSdk?: () => Promise<OpenAiSdk>
}): AiProvider {
  const loadSdk = options.loadSdk ?? (() => import('openai'))
  const secrets = options.apiKey ? [options.apiKey] : []
  let connecting: Promise<{ sdk: OpenAiSdk; client: OpenAI }> | undefined

  function connect() {
    connecting ??= loadSdk().then(
      (sdk) => ({
        sdk,
        client: new sdk.default({
          // Local servers such as Ollama ignore the key, but the SDK wants one.
          apiKey: options.apiKey || 'not-needed',
          baseURL:
            options.id === 'compatible' && options.baseUrl
              ? normalizeBaseUrl(options.baseUrl)
              : undefined,
          dangerouslyAllowBrowser: true,
          maxRetries: 0,
        }),
      }),
      (error: unknown) => {
        connecting = undefined
        throw new AiError(
          'network',
          "Couldn't load the OpenAI client. Check your connection.",
          { cause: error },
        )
      },
    )
    return connecting
  }

  return {
    id: options.id,

    async *chat(request): AsyncGenerator<ChatEvent> {
      const { sdk, client } = await connect()
      let cancel: (() => void) | undefined
      let finished = false
      try {
        const messages: ChatCompletionMessageParam[] = [
          ...(request.system
            ? [{ role: 'system' as const, content: request.system }]
            : []),
          ...toOpenAiMessages(request.messages),
        ]
        // OpenAI renamed the length cap; most compatible servers still use the old name.
        const lengthCap = request.maxTokens
          ? options.id === 'openai'
            ? { max_completion_tokens: request.maxTokens }
            : { max_tokens: request.maxTokens }
          : {}
        // Only compatible servers are asked: OpenAI's own models that don't
        // reason turn the field away, and the ones that do decide for
        // themselves how long to.
        const switchKey = `${normalizeBaseUrl(options.baseUrl ?? '')}|${request.model}`
        const switchOff =
          options.id === 'compatible' &&
          request.thinking === false &&
          !refusesThinkingSwitch.has(switchKey)
        const body: ChatCompletionCreateParamsStreaming = {
          model: request.model,
          messages,
          stream: true,
          stream_options: { include_usage: true },
          ...lengthCap,
        }
        const open = (withSwitch: boolean) =>
          client.chat.completions.create(
            withSwitch
              ? ({
                  ...body,
                  ...thinkingOff(options.baseUrl),
                } as ChatCompletionCreateParamsStreaming)
              : body,
            { signal: request.signal },
          )
        let created: Awaited<ReturnType<typeof open>>
        try {
          created = await open(switchOff)
        } catch (error) {
          if (!switchOff || !refusedSwitch(error, sdk)) throw error
          refusesThinkingSwitch.add(switchKey)
          created = await open(false)
        }
        const stream = created
        cancel = () => stream.controller.abort()
        let stopReason: StopReason = 'other'
        let refused = false
        const splitter = createThinkSplitter()
        for await (const chunk of stream) {
          const choice = chunk.choices[0]
          // Ollama and OpenRouter send thinking as `reasoning`; vLLM, LM
          // Studio and DeepSeek as `reasoning_content`.
          const delta = choice?.delta as
            | (ChatCompletionChunk.Choice.Delta & {
                reasoning?: string | null
                reasoning_content?: string | null
              })
            | undefined
          if (delta?.reasoning || delta?.reasoning_content)
            yield { type: 'thinking' }
          if (delta?.content) {
            const split = splitter.push(delta.content)
            if (split.thinking) yield { type: 'thinking' }
            if (split.text) yield { type: 'text', text: split.text }
          }
          if (choice?.delta?.refusal) {
            refused = true
            yield { type: 'text', text: choice.delta.refusal }
          }
          if (choice?.finish_reason)
            stopReason = mapFinishReason(choice.finish_reason)
          if (chunk.usage) {
            const usage: TokenUsage = {
              inputTokens: chunk.usage.prompt_tokens,
              outputTokens: chunk.usage.completion_tokens,
            }
            yield { type: 'usage', usage }
          }
        }
        // The SDK ends a cancelled stream quietly, as if the reply were done.
        if (request.signal?.aborted) throw abortError()
        const held = splitter.flush()
        if (held) yield { type: 'text', text: held }
        finished = true
        yield { type: 'done', stopReason: refused ? 'refusal' : stopReason }
      } catch (error) {
        throw normalizeSdkError(error, sdk, secrets)
      } finally {
        if (!finished) cancel?.()
      }
    },

    async embed(request) {
      const { sdk, client } = await connect()
      try {
        const response = await client.embeddings.create(
          // Floats, not the SDK's default base64: not every compatible server supports it.
          {
            model: request.model,
            input: request.input,
            encoding_format: 'float',
          },
          { signal: request.signal },
        )
        const vectors = [...response.data]
          .sort((a, b) => a.index - b.index)
          .map((item) => item.embedding)
        if (vectors.length !== request.input.length) {
          throw new AiError(
            'server',
            `Expected ${request.input.length} embeddings, got ${vectors.length}.`,
          )
        }
        return {
          vectors,
          usage: {
            inputTokens: response.usage?.prompt_tokens ?? 0,
            outputTokens: 0,
          },
        }
      } catch (error) {
        throw normalizeSdkError(error, sdk, secrets)
      }
    },

    async transcribe(request) {
      const { sdk, client } = await connect()
      try {
        const file = new File([request.audio], request.fileName, {
          type: request.audio.type || 'application/octet-stream',
        })
        const result = await client.audio.transcriptions.create(
          {
            model: request.model,
            file,
            response_format: 'json',
            ...(request.language ? { language: request.language } : {}),
          },
          { signal: request.signal },
        )
        // Whisper is billed by the minute, the GPT transcribers by token.
        const usage =
          result.usage?.type === 'tokens'
            ? {
                inputTokens: result.usage.input_tokens,
                outputTokens: result.usage.output_tokens,
              }
            : undefined
        return { text: result.text, ...(usage ? { usage } : {}) }
      } catch (error) {
        throw normalizeSdkError(error, sdk, secrets)
      }
    },

    async listModels(signal) {
      const { sdk, client } = await connect()
      try {
        const models: ModelInfo[] = []
        for await (const model of client.models.list({ signal }))
          models.push({ id: model.id })
        return models.sort((a, b) => a.id.localeCompare(b.id))
      } catch (error) {
        throw normalizeSdkError(error, sdk, secrets)
      }
    },
  }
}
