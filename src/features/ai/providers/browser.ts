import { abortError, AiError } from '../errors'
import { LOCAL_MODELS } from '../local/models'
import type { AiProvider, ChatEvent } from '../types'

/** Splits one long array of vectors into one array per vector. */
function split(vectors: Float32Array, dims: number): number[][] {
  const result: number[][] = []
  for (let start = 0; start < vectors.length; start += dims)
    result.push(Array.from(vectors.subarray(start, start + dims)))
  return result
}

/**
 * Embeddings from a model running in this browser. Nothing leaves the
 * device; the model is downloaded the first time it's needed (Settings says
 * so before that can happen), then works offline.
 */
export function createBrowserProvider(): AiProvider {
  return {
    id: 'browser',

    // A chat model on the GPU, through WebLLM in a worker: loaded with the
    // first request, not before.
    async *chat(request): AsyncGenerator<ChatEvent> {
      const { localChat } = await import('../local/chatDevice')
      yield* localChat.chat(request)
    },

    async transcribe() {
      throw new AiError(
        'unsupported',
        'The models on this device don’t transcribe speech. Choose OpenAI or a compatible server for transcription.',
      )
    },

    async embed({ model, input, signal }) {
      if (signal?.aborted) throw abortError()
      const { embedLocally } = await import('../local/client')
      let result: Awaited<ReturnType<typeof embedLocally>>
      try {
        result = await embedLocally(model, input)
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        // Downloads fail like any other request when offline.
        throw new AiError(
          /download|fetch|network/i.test(message) ? 'network' : 'unknown',
          /download|fetch|network/i.test(message)
            ? "Couldn't download the model. Check your connection and try again."
            : message,
          { cause: error },
        )
      }
      if (signal?.aborted) throw abortError()
      return {
        vectors: split(result.vectors, result.dims),
        usage: { inputTokens: result.tokens, outputTokens: 0 },
      }
    },

    async listModels() {
      return LOCAL_MODELS.map((model) => ({ id: model.id, name: model.name }))
    },
  }
}
