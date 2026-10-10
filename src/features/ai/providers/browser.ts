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

    chat(): AsyncIterable<ChatEvent> {
      const error = new AiError(
        'unsupported',
        'The model on this device makes embeddings only. Choose a chat provider in Settings → AI.',
      )
      return {
        [Symbol.asyncIterator]: () => ({ next: () => Promise.reject(error) }),
      }
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
