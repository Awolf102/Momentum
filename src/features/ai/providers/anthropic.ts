import type Anthropic from '@anthropic-ai/sdk'
import type {
  MessageDeltaUsage,
  StopReason as SdkStopReason,
  Usage,
} from '@anthropic-ai/sdk/resources/messages'
import { AiError } from '../errors'
import { normalizeSdkError } from '../lib/sdkErrors'
import type {
  AiProvider,
  ChatEvent,
  ModelInfo,
  StopReason,
  TokenUsage,
} from '../types'

type AnthropicSdk = typeof import('@anthropic-ai/sdk')

/**
 * Reply-length cap when a feature doesn't ask for one. Replies stream, so a
 * high cap can't time out, and Anthropic counts only the tokens actually
 * generated against rate limits. It's lowered to the model's own limit, as
 * reported by the Models API, when that is smaller.
 */
export const DEFAULT_MAX_TOKENS = 64_000

/** Each model's largest allowed `max_tokens`, from the Models API. */
const modelLimits = new Map<string, Promise<number | undefined>>()

function totalInput(
  usage: Pick<
    Usage,
    'cache_creation_input_tokens' | 'cache_read_input_tokens'
  > & { input_tokens: number | null },
): number {
  return (
    (usage.input_tokens ?? 0) +
    (usage.cache_creation_input_tokens ?? 0) +
    (usage.cache_read_input_tokens ?? 0)
  )
}

function mapStopReason(reason: SdkStopReason | null): StopReason {
  switch (reason) {
    case 'end_turn':
    case 'stop_sequence':
      return 'end'
    case 'max_tokens':
    case 'model_context_window_exceeded':
      return 'max-tokens'
    case 'refusal':
      return 'refusal'
    default:
      return 'other'
  }
}

export function createAnthropicProvider(options: {
  apiKey: string
  /** Swappable for tests; loads the SDK only when it's first needed. */
  loadSdk?: () => Promise<AnthropicSdk>
}): AiProvider {
  const loadSdk = options.loadSdk ?? (() => import('@anthropic-ai/sdk'))
  let connecting: Promise<{ sdk: AnthropicSdk; client: Anthropic }> | undefined

  function connect() {
    connecting ??= loadSdk().then(
      (sdk) => ({
        sdk,
        client: new sdk.default({
          apiKey: options.apiKey,
          // Momentum has no server: requests go straight from this browser
          // to Anthropic with the user's own key, kept on this device.
          dangerouslyAllowBrowser: true,
          // Retries happen in Momentum's own layer, so they are visible
          // and consistent across providers.
          maxRetries: 0,
        }),
      }),
      (error: unknown) => {
        connecting = undefined
        throw new AiError(
          'network',
          "Couldn't load the Anthropic client. Check your connection.",
          { cause: error },
        )
      },
    )
    return connecting
  }

  async function maxTokensFor(
    client: Anthropic,
    model: string,
    requested: number | undefined,
  ) {
    let limit = modelLimits.get(model)
    if (!limit) {
      limit = client.models.retrieve(model).then(
        (info) => info.max_tokens ?? undefined,
        () => undefined,
      )
      modelLimits.set(model, limit)
    }
    return Math.min(
      requested ?? DEFAULT_MAX_TOKENS,
      (await limit) ?? Number.POSITIVE_INFINITY,
    )
  }

  return {
    id: 'anthropic',

    async *chat(request): AsyncGenerator<ChatEvent> {
      const { sdk, client } = await connect()
      let stream: ReturnType<Anthropic['messages']['stream']> | undefined
      let finished = false
      try {
        const maxTokens = await maxTokensFor(
          client,
          request.model,
          request.maxTokens,
        )
        stream = client.messages.stream(
          {
            model: request.model,
            max_tokens: maxTokens,
            messages: request.messages,
            ...(request.system ? { system: request.system } : {}),
          },
          { signal: request.signal },
        )
        let usage: TokenUsage = { inputTokens: 0, outputTokens: 0 }
        let stopReason: StopReason = 'other'
        for await (const event of stream) {
          if (event.type === 'message_start') {
            usage = {
              inputTokens: totalInput(event.message.usage),
              outputTokens: event.message.usage.output_tokens,
            }
            yield { type: 'usage', usage }
          } else if (
            event.type === 'content_block_delta' &&
            event.delta.type === 'text_delta'
          ) {
            if (event.delta.text) yield { type: 'text', text: event.delta.text }
          } else if (event.type === 'message_delta') {
            usage = deltaUsage(usage, event.usage)
            stopReason = mapStopReason(event.delta.stop_reason)
            yield { type: 'usage', usage }
          }
        }
        finished = true
        yield { type: 'done', stopReason }
      } catch (error) {
        throw normalizeSdkError(error, sdk, [options.apiKey])
      } finally {
        // The caller stopped reading early: cancel the request.
        if (!finished) stream?.abort()
      }
    },

    async embed() {
      throw new AiError(
        'unsupported',
        "Anthropic doesn't offer embeddings. Choose OpenAI or an OpenAI-compatible server for them.",
      )
    },

    async listModels(signal) {
      const { sdk, client } = await connect()
      try {
        const models: ModelInfo[] = []
        for await (const model of client.models.list(
          { limit: 100 },
          { signal },
        )) {
          if (model.lifecycle === 'retired') continue
          models.push({
            id: model.id,
            name: model.display_name,
            maxOutputTokens: model.max_tokens ?? undefined,
            deprecated: model.lifecycle === 'deprecated',
          })
        }
        return models
      } catch (error) {
        throw normalizeSdkError(error, sdk, [options.apiKey])
      }
    },
  }
}

function deltaUsage(
  previous: TokenUsage,
  usage: MessageDeltaUsage,
): TokenUsage {
  return {
    // Input totals may be left out of the final event (not just null): keep
    // the count from the start of the message then.
    inputTokens:
      usage.input_tokens == null ? previous.inputTokens : totalInput(usage),
    outputTokens: usage.output_tokens,
  }
}
