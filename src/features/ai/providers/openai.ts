import type OpenAI from 'openai'
import type {
  ChatCompletionChunk,
  ChatCompletionContentPart,
  ChatCompletionMessageParam,
} from 'openai/resources/chat/completions'
import { abortError, AiError } from '../errors'
import { textOf } from '../lib/content'
import { normalizeSdkError } from '../lib/sdkErrors'
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
        const created = await client.chat.completions.create(
          {
            model: request.model,
            messages,
            stream: true,
            stream_options: { include_usage: true },
            ...lengthCap,
          },
          { signal: request.signal },
        )
        cancel = () => created.controller.abort()
        let stopReason: StopReason = 'other'
        let refused = false
        for await (const chunk of created) {
          const choice = chunk.choices[0]
          if (choice?.delta?.content)
            yield { type: 'text', text: choice.delta.content }
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
