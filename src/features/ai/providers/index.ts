import type { AiProvider, Connection } from '../types'
import { createAnthropicProvider } from './anthropic'
import { createBrowserProvider } from './browser'
import { createOpenAiProvider } from './openai'

/** The adapter for a connection. SDKs load on first use, not here. */
export function createProvider(connection: Connection): AiProvider {
  switch (connection.provider) {
    case 'anthropic':
      return createAnthropicProvider({ apiKey: connection.apiKey ?? '' })
    case 'openai':
      return createOpenAiProvider({ id: 'openai', apiKey: connection.apiKey })
    case 'compatible':
      return createOpenAiProvider({
        id: 'compatible',
        apiKey: connection.apiKey,
        baseUrl: connection.baseUrl,
      })
    case 'browser':
      return createBrowserProvider()
  }
}
